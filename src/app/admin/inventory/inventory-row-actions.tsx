"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { setVehicleStatus, deleteVehicle } from "./actions";

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "available", label: "Available" },
  { value: "reserved", label: "Reserved" },
  { value: "sold", label: "Sold" },
  { value: "archived", label: "Archived" },
] as const;

const PUBLIC = new Set(["available", "reserved", "sold"]);

/** What a status change does to the public site, when it does anything visible. */
function statusConsequence(from: string, to: string): string | null {
  if (!PUBLIC.has(from) && PUBLIC.has(to)) return "The car will appear on the public website and in the sitemap.";
  if (PUBLIC.has(from) && !PUBLIC.has(to)) return "The car will be removed from the public website; its page will stop resolving.";
  return null;
}

export function InventoryRowActions({
  vehicleId,
  vehicleTitle,
  currentStatus,
}: {
  vehicleId: string;
  vehicleTitle: string;
  currentStatus: string;
}) {
  const [pending, startTransition] = useTransition();
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function applyStatus(status: string) {
    startTransition(async () => {
      const res = await setVehicleStatus(vehicleId, status);
      setPendingStatus(null);
      if (res?.error) toast.error(`Status not changed: ${res.error}`);
      else toast.success(`${vehicleTitle} is now ${status}.`);
    });
  }

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    if (next === currentStatus) return;
    // Changes that publish or unpublish a car are confirmed; internal moves
    // (e.g. available ↔ reserved) apply immediately.
    if (statusConsequence(currentStatus, next)) setPendingStatus(next);
    else applyStatus(next);
  }

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteVehicle(vehicleId, false);
      if (res?.error) {
        toast.error(`Vehicle not deleted: ${res.error}`);
      } else {
        setConfirmDelete(false);
        toast.success(`${vehicleTitle} deleted.`);
      }
    });
  }

  const selectId = `status-${vehicleId}`;

  return (
    <div className="flex items-center justify-end gap-3">
      <label htmlFor={selectId} className="sr-only">
        Status of {vehicleTitle}
      </label>
      <select
        id={selectId}
        value={currentStatus}
        onChange={handleStatusChange}
        disabled={pending}
        className="rounded-md border border-input bg-card px-2 py-1 text-xs text-foreground focus-visible:border-accent-bright disabled:opacity-50"
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <Link
        href={`/admin/inventory/${vehicleId}`}
        className="inline-flex size-8 items-center justify-center rounded-md text-primary hover:bg-muted"
        aria-label={`Edit ${vehicleTitle}`}
        title="Edit"
      >
        <Edit className="size-4" aria-hidden="true" />
      </Link>

      <button
        type="button"
        disabled={pending}
        onClick={() => setConfirmDelete(true)}
        className="inline-flex size-8 items-center justify-center rounded-md text-danger hover:bg-danger/10 disabled:opacity-50"
        aria-label={`Delete ${vehicleTitle}`}
        title="Delete"
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </button>

      <ConfirmDialog
        open={pendingStatus !== null}
        onOpenChange={(open) => !open && setPendingStatus(null)}
        title={`Mark ${vehicleTitle} as ${pendingStatus ?? ""}?`}
        description={pendingStatus ? statusConsequence(currentStatus, pendingStatus) : null}
        confirmLabel="Change status"
        pending={pending}
        onConfirm={() => pendingStatus && applyStatus(pendingStatus)}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${vehicleTitle}?`}
        description="This permanently removes the listing. To take a car off the site but keep its record and history, set it to Archived instead."
        confirmLabel="Delete vehicle"
        destructive
        pending={pending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
