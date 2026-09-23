"use client";

import { useState, useTransition, useRef } from "react";
import Link from "next/link";
import { Edit, Trash2 } from "lucide-react";
import { setVehicleStatus, deleteVehicle } from "./actions";
import { toast } from "sonner";

export function InventoryRowActions({ vehicleId, currentStatus }: { vehicleId: string; currentStatus: string }) {
  const [pending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteTimeoutRef = useRef<NodeJS.Timeout>(null);

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value;
    if (newStatus === currentStatus) return;
    
    startTransition(async () => {
      const res = await setVehicleStatus(vehicleId, newStatus);
      if (res?.error) {
        toast.error("Failed to change status: " + res.error);
      } else {
        toast.success("Status updated");
      }
    });
  }

  function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current);
      deleteTimeoutRef.current = setTimeout(() => setConfirmingDelete(false), 3000);
    } else {
      startTransition(async () => {
        const res = await deleteVehicle(vehicleId, false);
        if (res?.error) {
          toast.error("Failed to delete vehicle: " + res.error);
        } else {
          toast.success("Vehicle deleted");
        }
      });
    }
  }

  return (
    <div className="flex items-center justify-end gap-3">
      <select
        value={currentStatus}
        onChange={handleStatusChange}
        disabled={pending}
        className="rounded-lg border border-border bg-card px-2 py-1 text-xs text-foreground disabled:opacity-50"
      >
        <option value="draft">Draft</option>
        <option value="available">Available</option>
        <option value="reserved">Reserved</option>
        <option value="sold">Sold</option>
        <option value="archived">Archived</option>
      </select>
      
      <Link 
        href={`/admin/inventory/${vehicleId}`} 
        className="text-primary hover:underline"
        title="Edit"
      >
        <Edit className="size-4" />
      </Link>
      
      <button 
        disabled={pending} 
        onClick={handleDelete} 
        className={`disabled:opacity-50 transition-colors ${confirmingDelete ? "text-danger bg-danger/10 px-2 py-1 rounded-md font-bold" : "text-danger hover:opacity-70"}`}
        title="Delete"
      >
        {confirmingDelete ? <span className="text-xs">Confirm?</span> : <Trash2 className="size-4" />}
      </button>
    </div>
  );
}
