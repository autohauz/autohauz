"use client";

import { useActionState } from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2, Radio } from "lucide-react";
import { saveSyndicationExtra } from "@/app/admin/inventory/syndication-actions";
import { syndicationConditions, syndicationPriceTypes, auStates } from "@/lib/validation/syndication";
import type { ReadinessResult } from "@/lib/syndication/readiness";

/* eslint-disable @typescript-eslint/no-explicit-any --
   Sidecar row is read through the untyped Supabase client, matching the
   loosely-typed `VehicleData` convention in vehicle-form.tsx. */

const inputCls =
  "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus-visible:border-accent-bright transition-shadow";

const CONDITION_LABELS: Record<string, string> = {
  used: "Used",
  cpo: "Certified pre-owned",
  demo: "Demonstrator",
};

const PRICE_TYPE_LABELS: Record<string, string> = {
  drive_away: "Drive-away (includes on-road costs)",
  ex_gov: "Excludes government charges",
};

function L({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

/**
 * Identity & Compliance panel — the syndication sidecar editor.
 *
 * Deliberately a SEPARATE form from `VehicleForm`, posting to a separate server
 * action that only ever writes `syndication_vehicle_extra`. The website's own
 * vehicle save path is untouched, so a syndication bug can never stop staff
 * editing a car.
 *
 * The readiness list above the fields is rendered from the exact same
 * `evaluateReadiness` used at publish time (architecture.md §5) — a staff
 * member sees precisely what a channel will reject, before publishing, with the
 * plain-English fix hint for each blocker (failure-modes.md F19).
 */
export function SyndicationPanel({
  vehicleId,
  extra,
  readiness,
}: {
  vehicleId: string;
  extra: any | null;
  readiness: ReadinessResult;
}) {
  const [state, formAction, pending] = useActionState(saveSyndicationExtra, undefined);
  const result = (state as any)?.readiness as ReadinessResult | undefined;
  const current = result ?? readiness;

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-foreground">
            <Radio className="size-5 text-primary" />
            Identity &amp; Compliance
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Required before this vehicle can be advertised on Google, Meta or the classifieds.
          </p>
        </div>
        {current.ready ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success/10 px-3 py-1.5 text-xs font-semibold text-success">
            <CheckCircle2 className="size-3.5" /> Ready to publish
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive">
            <AlertTriangle className="size-3.5" />
            {current.rejections.length} blocker{current.rejections.length === 1 ? "" : "s"}
          </span>
        )}
      </header>

      {current.rejections.length > 0 ? (
        <ul className="mb-5 space-y-2.5">
          {current.rejections.map((r) => (
            <li key={r.code} className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-sm font-medium text-foreground">{r.message}</p>
              <p className="mt-1 text-xs text-muted-foreground">{r.fixHint}</p>
            </li>
          ))}
        </ul>
      ) : null}

      {current.warnings.length > 0 ? (
        <ul className="mb-5 space-y-2">
          {current.warnings.map((w) => (
            <li key={w.code} className="flex gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0" />
              {w.message}
            </li>
          ))}
        </ul>
      ) : null}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="vehicleId" value={vehicleId} />
        {/* Optimistic lock: the version this form was rendered from (F13). */}
        {extra?.version != null ? <input type="hidden" name="version" value={extra.version} /> : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <L label="Condition">
            <select name="condition" defaultValue={extra?.condition ?? "used"} className={inputCls}>
              {syndicationConditions.map((c) => (
                <option key={c} value={c}>{CONDITION_LABELS[c]}</option>
              ))}
            </select>
          </L>

          <L
            label="Price type *"
            hint="Must be set explicitly — advertising the wrong one is a misleading-price risk."
          >
            <select name="priceType" defaultValue={extra?.price_type ?? ""} className={inputCls}>
              <option value="">— Select —</option>
              {syndicationPriceTypes.map((p) => (
                <option key={p} value={p}>{PRICE_TYPE_LABELS[p]}</option>
              ))}
            </select>
          </L>

          <L label="Rego state">
            <select name="regoState" defaultValue={extra?.rego_state ?? ""} className={inputCls}>
              <option value="">—</option>
              {auStates.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </L>

          <L label="Badge" hint="Trim badge, if different from the variant.">
            <input name="badge" defaultValue={extra?.badge ?? ""} className={inputCls} placeholder="GXL" />
          </L>

          <L label="Build date">
            <input name="buildDate" type="date" defaultValue={extra?.build_date ?? ""} className={inputCls} />
          </L>

          <L label="Compliance date">
            <input name="complianceDate" type="date" defaultValue={extra?.compliance_date ?? ""} className={inputCls} />
          </L>

          <L label="Engine (cc)">
            <input name="engineCc" type="number" defaultValue={extra?.engine_cc ?? ""} className={inputCls} placeholder="2800" />
          </L>
        </div>

        <label className="flex items-start gap-2.5 rounded-lg border border-border p-3">
          <input
            type="checkbox"
            name="wovrFlag"
            defaultChecked={extra?.wovr_flag ?? false}
            className="mt-0.5 size-4 rounded border-border"
          />
          <span className="text-sm">
            <span className="font-medium text-foreground">Listed on the written-off vehicle register (WOVR)</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              If ticked, the description must disclose it. This is a legal requirement.
            </span>
          </span>
        </label>

        {(state as any)?.error ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {(state as any).error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Save compliance details
        </button>
      </form>
    </section>
  );
}
