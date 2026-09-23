"use client";

import { useActionState, useState, useEffect, useRef } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createMake, deleteMake, createModel, deleteModel } from "./actions";
import type { Make, Model } from "@/lib/domain";

const inputCls = "rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow";
const btnPrimary = "inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover transition-colors disabled:opacity-60";
const btnDanger = "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-danger hover:bg-danger/10 transition-colors";

// ── Add Make Form ────────────────────────────────────────────────────────────
export function AddMakeForm() {
  const [, action, pending] = useActionState(createMake, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[180px]">
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Make name</label>
        <input name="name" required placeholder="e.g. Zeekr" className={inputCls + " w-full"} />
      </div>
      <label className="flex items-center gap-2 text-sm text-foreground pb-2">
        <input type="checkbox" name="isPopular" className="size-4 rounded border-border" />
        Popular
      </label>
      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        Add make
      </button>
    </form>
  );
}

// ── Delete Make Button ───────────────────────────────────────────────────────
export function DeleteMakeButton({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = useActionState(deleteMake, undefined);
  const [confirming, setConfirming] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>(null);

  useEffect(() => {
    if (state?.ok) {
      toast.success(`Make "${name}" deleted`);
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, name]);

  const handleClick = (e: React.MouseEvent) => {
    if (!confirming) {
      e.preventDefault();
      setConfirming(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setConfirming(false), 3000);
    }
  };

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        onClick={handleClick}
        className={confirming ? "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-white bg-danger hover:bg-danger/90 transition-colors" : btnDanger}
      >
        {pending ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
        {confirming ? "Click to confirm" : "Delete"}
      </button>
    </form>
  );
}

// ── Make Row (expandable) ─────────────────────────────────────────────────────
export function MakeRow({ make, models }: { make: Make; models: Model[] }) {
  const [open, setOpen] = useState(false);
  const [, addAction, addPending] = useActionState(createModel, undefined);
  const myModels = models.filter((m) => m.makeId === make.id);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex flex-1 items-center gap-2 text-left"
        >
          {open ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
          <span className="font-semibold text-foreground">{make.name}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{myModels.length} models</span>
          {make.isPopular && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Popular</span>}
        </button>
        <DeleteMakeButton id={make.id} name={make.name} />
      </div>

      {open && (
        <div className="border-t border-border bg-background px-4 py-4 space-y-4">
          {/* Model list */}
          <div className="flex flex-wrap gap-2">
            {myModels.map((model) => (
              <ModelChip key={model.id} model={model} />
            ))}
            {myModels.length === 0 && <p className="text-xs text-muted-foreground">No models yet.</p>}
          </div>

          {/* Add model */}
          <form action={addAction} className="flex items-end gap-2">
            <input type="hidden" name="makeId" value={make.id} />
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Add model to {make.name}</label>
              <input name="name" required placeholder="e.g. EX30" className={inputCls + " w-full"} />
            </div>
            <button type="submit" disabled={addPending} className={btnPrimary}>
              {addPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Add
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function ModelChip({ model }: { model: Model }) {
  const [state, action, pending] = useActionState(deleteModel, undefined);
  const [confirming, setConfirming] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>(null);

  useEffect(() => {
    if (state?.ok) {
      toast.success(`Model "${model.name}" deleted`);
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, model.name]);

  const handleClick = (e: React.MouseEvent) => {
    if (!confirming) {
      e.preventDefault();
      setConfirming(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setConfirming(false), 3000);
    }
  };

  return (
    <form action={action} className="inline-flex">
      <input type="hidden" name="id" value={model.id} />
      <div className={`flex items-center gap-1 rounded-full border px-3 py-1 text-sm transition-colors ${confirming ? "border-danger bg-danger/10 text-danger" : "border-border bg-card text-foreground"}`}>
        {model.name}
        <button
          type="submit"
          disabled={pending}
          onClick={handleClick}
          className={`ml-1 transition-colors ${confirming ? "text-danger hover:text-danger/80 font-bold" : "text-muted-foreground hover:text-danger"}`}
        >
          {pending ? <Loader2 className="size-3 animate-spin" /> : (confirming ? "Confirm?" : <Trash2 className="size-3" />)}
        </button>
      </div>
    </form>
  );
}
