"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import type { BusinessProfile } from "@/config/business";
import {
  saveBusinessAddress,
  saveCompanyProfile,
  saveFinanceParams,
  saveInvoiceSettings,
  saveLocationHours,
  saveNotificationRecipients,
  savePhoneNumbers,
  saveSocialLinks,
} from "./actions";

const input = "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground";
type Action = (state: { ok?: boolean; error?: string } | undefined, fd: FormData) => Promise<{ ok?: boolean; error?: string }>;

function Card({ title, description, action, children }: { title: string; description?: string; action: Action; children: React.ReactNode }) {
  const [state, formAction, pending] = useActionState(action, undefined);

  useEffect(() => {
    if (state?.ok) toast.success(`${title} saved`);
    else if (state?.error) toast.error(state.error);
  }, [state, title]);

  return (
    <form action={formAction} className="flex h-full flex-col space-y-3 rounded-xl border border-border bg-card p-5">
      <div>
        <h2 className="font-heading text-lg font-bold text-foreground">{title}</h2>
        {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="flex-1 space-y-3">{children}</div>
      <div className="flex items-center gap-3 pt-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function L({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-foreground">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm text-foreground">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="size-4 rounded border-border accent-primary" />
      {label}
    </label>
  );
}

const AU_STATES = ["", "NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];
const DAYS: Array<[keyof BusinessProfile["hours"], string]> = [
  ["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"], ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"],
];

export function SettingsForms({
  business,
  finance,
  recipients,
}: {
  business: BusinessProfile;
  finance: { annualRate: number; termMonths: number; depositPct: number; disclaimer: string };
  recipients: string[];
}) {
  const inv = business.invoice;
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card title="Business identity" description="Shown in the footer, legal pages, structured data and on every invoice." action={saveCompanyProfile}>
        <div className="grid grid-cols-2 gap-3">
          <L label="Legal name" hint="Registered entity, e.g. Example Motors Pty Ltd"><input name="legalName" defaultValue={business.legalName} className={input} autoComplete="organization" /></L>
          <L label="Trading name"><input name="tradingName" defaultValue={business.tradingName} className={input} /></L>
          <L label="ABN" hint="11 digits; validated against the ATO checksum"><input name="abn" defaultValue={business.abn} className={input} inputMode="numeric" /></L>
          <L label="Email"><input name="email" type="email" defaultValue={business.email} className={input} autoComplete="email" /></L>
          <L label="Google rating" hint="Only genuine figures. Leave blank to hide."><input name="googleRating" type="number" step="0.1" min="0" max="5" defaultValue={business.googleRating ?? ""} className={input} /></L>
          <L label="Google review count"><input name="googleReviewCount" type="number" min="0" defaultValue={business.googleReviewCount ?? ""} className={input} /></L>
        </div>
      </Card>

      <Card title="Address" description="Rendered in the footer, contact page, map and LocalBusiness schema only when complete." action={saveBusinessAddress}>
        <L label="Street"><input name="street" defaultValue={business.address.street} className={input} autoComplete="street-address" /></L>
        <div className="grid grid-cols-3 gap-3">
          <L label="Suburb"><input name="suburb" defaultValue={business.address.suburb} className={input} autoComplete="address-level2" /></L>
          <L label="State">
            <select name="state" defaultValue={business.address.state} className={input}>
              {AU_STATES.map((s) => (<option key={s} value={s}>{s || "—"}</option>))}
            </select>
          </L>
          <L label="Postcode"><input name="postcode" defaultValue={business.address.postcode} className={input} inputMode="numeric" autoComplete="postal-code" /></L>
        </div>
        <input type="hidden" name="country" value="Australia" />
      </Card>

      <Card title="Phone & WhatsApp" description="Blank hides the corresponding button site-wide." action={savePhoneNumbers}>
        <L label="Primary phone (as displayed)"><input name="primary" defaultValue={business.phone} className={input} placeholder="02 9123 4567" autoComplete="tel" /></L>
        <L label="WhatsApp number" hint="International format, digits only, e.g. 61412345678"><input name="whatsapp" defaultValue={business.whatsapp} className={input} inputMode="numeric" /></L>
      </Card>

      <Card title="Opening hours" description="Use 9:00-17:30 or closed." action={saveLocationHours}>
        <div className="grid grid-cols-2 gap-3">
          {DAYS.map(([key, label]) => (
            <L key={key} label={label}><input name={key} defaultValue={business.hours[key] ?? ""} className={input} placeholder="9:00-17:30 or closed" /></L>
          ))}
        </div>
      </Card>

      <Card title="Invoices & GST" description="Defaults for new invoices. Changing GST settings does not alter invoices already issued." action={saveInvoiceSettings}>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 flex flex-wrap gap-6">
            <Check name="gstEnabled" label="Charge GST" defaultChecked={inv.gstEnabled} />
            <Check name="pricesIncludeGst" label="Entered prices include GST" defaultChecked={inv.pricesIncludeGst} />
          </div>
          <L label="GST rate %"><input name="gstRate" type="number" step="0.01" min="0" max="100" defaultValue={inv.gstRate} className={input} /></L>
          <L label="Invoice number prefix" hint="e.g. AH → AH-2026-000001"><input name="numberPrefix" defaultValue={inv.numberPrefix} className={input} maxLength={6} /></L>
          <L label="Due after (days)"><input name="dueDays" type="number" min="0" max="365" defaultValue={inv.dueDays} className={input} /></L>
        </div>
        <L label="Payment terms (printed on invoices)"><textarea name="paymentTerms" rows={2} defaultValue={inv.paymentTerms} className={input} /></L>
        <L label="Footer note"><textarea name="footerNote" rows={2} defaultValue={inv.footerNote} className={input} placeholder="Thank you for your business." /></L>
        <div className="grid grid-cols-2 gap-3">
          <L label="Bank account name"><input name="bankAccountName" defaultValue={inv.bank.accountName} className={input} /></L>
          <L label="BSB"><input name="bankBsb" defaultValue={inv.bank.bsb} className={input} inputMode="numeric" placeholder="062-000" /></L>
          <L label="Account number"><input name="bankAccountNumber" defaultValue={inv.bank.accountNumber} className={input} inputMode="numeric" /></L>
          <L label="PayID"><input name="payId" defaultValue={inv.bank.payId} className={input} /></L>
        </div>
      </Card>

      <Card title="Finance estimate" description="Drives the repayment calculator on vehicle pages." action={saveFinanceParams}>
        <div className="grid grid-cols-3 gap-3">
          <L label="Annual rate %"><input name="annualRate" type="number" step="0.01" defaultValue={finance.annualRate} className={input} /></L>
          <L label="Term (months)"><input name="termMonths" type="number" defaultValue={finance.termMonths} className={input} /></L>
          <L label="Deposit %"><input name="depositPct" type="number" defaultValue={finance.depositPct} className={input} /></L>
        </div>
        <L label="Disclaimer"><textarea name="disclaimer" rows={3} defaultValue={finance.disclaimer} className={input} /></L>
      </Card>

      <Card title="Social profiles" description="Full URLs only. Blank entries are not shown." action={saveSocialLinks}>
        <div className="grid grid-cols-2 gap-3">
          {(["facebook", "instagram", "linkedin", "x", "youtube", "tiktok"] as const).map((k) => (
            <L key={k} label={k === "x" ? "X (Twitter)" : k.charAt(0).toUpperCase() + k.slice(1)}>
              <input name={k} type="url" defaultValue={business.social[k]} className={input} placeholder="https://" />
            </L>
          ))}
        </div>
      </Card>

      <Card title="Lead notifications" description="New leads and the daily reminder digest are emailed to these addresses." action={saveNotificationRecipients}>
        <L label="Recipient emails (one per line)"><textarea name="emails" rows={4} defaultValue={recipients.join("\n")} className={input} placeholder="info@jashire.com.au" /></L>
      </Card>
    </div>
  );
}
