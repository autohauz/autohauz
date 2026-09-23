"use client";

import { useEffect, useRef, useState } from "react";
import { Field, TextInput, Select, Honeypot, ConsentCheckbox, TurnstileField, SubmitButton, LeadSuccess, FormError, PRIVACY_MICROCOPY, PHONE_PATTERN } from "@/components/leads/lead-form-kit";
import { submitLead } from "@/lib/leads/submit";

/** Finance enquiry. Email and consent are required because details go to a finance partner. */
export function FinanceForm({
  vehicleId,
  phone,
  whatsappUrl,
  deposit,
  weekly,
}: {
  vehicleId?: string;
  phone?: string | null;
  whatsappUrl?: string | null;
  deposit?: number;
  weekly?: number;
}) {
  const [f, setF] = useState({ name: "", phone: "", email: "", employmentStatus: "", depositAmount: "", weeklyBudget: "" });
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [token, setToken] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // Whether the buyer has hand-edited the amount fields. Once touched, we show
  // their value; until then the field mirrors the calculator (derived below —
  // no effect needed, so we never clobber typed input).
  const [depositTouched, setDepositTouched] = useState(false);
  const [weeklyTouched, setWeeklyTouched] = useState(false);
  const renderedAt = useRef(0);
  useEffect(() => {
    renderedAt.current = Date.now();
  }, []);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const depositAmount = depositTouched ? f.depositAmount : deposit && deposit > 0 ? String(deposit) : "";
  const weeklyBudget = weeklyTouched ? f.weeklyBudget : weekly && weekly > 0 ? String(weekly) : "";
  const prefillHint = !depositTouched && !weeklyTouched && (depositAmount !== "" || weeklyBudget !== "");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) {
      setError("Tick the box to confirm we can contact you about finance.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await submitLead({
      type: "finance",
      vehicleId,
      name: f.name,
      phone: f.phone,
      email: f.email,
      employmentStatus: f.employmentStatus || undefined,
      depositAmount: depositAmount || undefined,
      weeklyBudget: weeklyBudget || undefined,
      consent: true,
      website,
      formRenderedAt: renderedAt.current,
      turnstileToken: token,
    });
    setLoading(false);
    if (res.ok) setDone(true);
    else setError(res.error);
  }

  if (done) return <LeadSuccess heading="Thanks — our finance partner will be in touch." phone={phone} whatsappUrl={whatsappUrl} />;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Honeypot value={website} onChange={setWebsite} />
      <Field label="Name" required>
        {(c) => <TextInput {...c} value={f.name} onChange={set("name")} required autoComplete="name" disabled={loading} />}
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Phone" required>
          {(c) => <TextInput {...c} value={f.phone} onChange={set("phone")} required type="tel" inputMode="tel" autoComplete="tel" placeholder="04XX XXX XXX" pattern={PHONE_PATTERN} disabled={loading} />}
        </Field>
        <Field label="Email" required>
          {(c) => <TextInput {...c} value={f.email} onChange={set("email")} required type="email" inputMode="email" autoComplete="email" disabled={loading} />}
        </Field>
      </div>
      <Field label="Employment status">
        {(c) => (
          <Select {...c} value={f.employmentStatus} onChange={set("employmentStatus")} disabled={loading}>
            <option value="">Select…</option>
            <option>Full-time</option>
            <option>Part-time</option>
            <option>Casual</option>
            <option>Self-employed</option>
            <option>Contractor</option>
            <option>Other</option>
          </Select>
        )}
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Deposit (approx.)" hint={prefillHint ? "Pre-filled from the calculator — change it if you like." : undefined}>
          {(c) => (
            <TextInput
              {...c}
              value={depositAmount}
              onChange={(e) => {
                setDepositTouched(true);
                setF({ ...f, depositAmount: e.target.value });
              }}
              inputMode="numeric"
              placeholder="$"
              disabled={loading}
            />
          )}
        </Field>
        <Field label="Weekly budget">
          {(c) => (
            <TextInput
              {...c}
              value={weeklyBudget}
              onChange={(e) => {
                setWeeklyTouched(true);
                setF({ ...f, weeklyBudget: e.target.value });
              }}
              inputMode="numeric"
              placeholder="$ per week"
              disabled={loading}
            />
          )}
        </Field>
      </div>
      <ConsentCheckbox checked={consent} onChange={setConsent}>
        I agree to be contacted about finance and for my details to be shared with a finance partner.
      </ConsentCheckbox>
      <TurnstileField onToken={setToken} />
      {error ? <FormError>{error}</FormError> : null}
      <SubmitButton loading={loading}>Enquire about finance</SubmitButton>
      <p className="text-xs text-muted-foreground">{PRIVACY_MICROCOPY}</p>
    </form>
  );
}
