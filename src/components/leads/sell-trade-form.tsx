"use client";

import { useEffect, useRef, useState } from "react";
import { Field, TextInput, Select, TextArea, Honeypot, TurnstileField, SubmitButton, LeadSuccess, FormError, PRIVACY_MICROCOPY, PHONE_PATTERN } from "@/components/leads/lead-form-kit";
import { submitLead } from "@/lib/leads/submit";

/**
 * Sell-your-car and trade-in share a shape: current-car details + contact.
 * `mode` picks the lead type and field names.
 */
export function SellTradeForm({ mode, vehicleId, phone, whatsappUrl }: { mode: "sell" | "trade_in"; vehicleId?: string; phone?: string | null; whatsappUrl?: string | null }) {
  const [f, setF] = useState({ make: "", model: "", year: "", km: "", condition: "good", registration: "", expectedPrice: "", name: "", phone: "", notes: "" });
  const [website, setWebsite] = useState("");
  const [token, setToken] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const renderedAt = useRef(0);
  useEffect(() => {
    renderedAt.current = Date.now();
  }, []);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const carFields =
      mode === "sell"
        ? { make: f.make, model: f.model, year: f.year, mileageKm: f.km, condition: f.condition }
        : { tradeMake: f.make, tradeModel: f.model, tradeYear: f.year, tradeMileageKm: f.km, tradeCondition: f.condition };
    const res = await submitLead({
      type: mode,
      vehicleId,
      name: f.name,
      phone: f.phone,
      message: f.notes || undefined,
      ...carFields,
      registration: f.registration || undefined,
      expectedPrice: f.expectedPrice || undefined,
      website,
      formRenderedAt: renderedAt.current,
      turnstileToken: token,
    });
    setLoading(false);
    if (res.ok) setDone(true);
    else setError(res.error);
  }

  if (done) {
    return (
      <LeadSuccess
        heading={mode === "sell" ? "Thanks — we'll be in touch with an offer." : "Thanks — we'll value your trade-in."}
        phone={phone}
        whatsappUrl={whatsappUrl}
      />
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Honeypot value={website} onChange={setWebsite} />
      <fieldset className="space-y-4">
        <legend className="mb-1 text-base font-semibold text-foreground">Your car</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Make" required>
            {(c) => <TextInput {...c} value={f.make} onChange={set("make")} required placeholder="e.g. Toyota" disabled={loading} />}
          </Field>
          <Field label="Model" required>
            {(c) => <TextInput {...c} value={f.model} onChange={set("model")} required placeholder="e.g. Corolla" disabled={loading} />}
          </Field>
          <Field label="Year" required>
            {(c) => <TextInput {...c} value={f.year} onChange={set("year")} required inputMode="numeric" pattern="[0-9]{4}" maxLength={4} placeholder="e.g. 2018" disabled={loading} />}
          </Field>
          <Field label="Kilometres" required>
            {(c) => <TextInput {...c} value={f.km} onChange={set("km")} required inputMode="numeric" placeholder="e.g. 65000" disabled={loading} />}
          </Field>
          <Field label="Condition">
            {(c) => (
              <Select {...c} value={f.condition} onChange={set("condition")} disabled={loading}>
                <option value="excellent">Excellent</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="poor">Poor</option>
              </Select>
            )}
          </Field>
          <Field label="Registration" hint="Optional">
            {(c) => <TextInput {...c} value={f.registration} onChange={set("registration")} autoCapitalize="characters" disabled={loading} />}
          </Field>
        </div>
        <Field label="Price you're hoping for" hint="Optional — it helps us come back with a realistic offer.">
          {(c) => <TextInput {...c} value={f.expectedPrice} onChange={set("expectedPrice")} inputMode="numeric" placeholder="$" disabled={loading} />}
        </Field>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-1 text-base font-semibold text-foreground">Your details</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name" required>
            {(c) => <TextInput {...c} value={f.name} onChange={set("name")} required autoComplete="name" disabled={loading} />}
          </Field>
          <Field label="Phone" required>
            {(c) => <TextInput {...c} value={f.phone} onChange={set("phone")} required type="tel" inputMode="tel" autoComplete="tel" placeholder="04XX XXX XXX" pattern={PHONE_PATTERN} disabled={loading} />}
          </Field>
        </div>
        <Field label="Anything else?">{(c) => <TextArea {...c} value={f.notes} onChange={set("notes")} disabled={loading} />}</Field>
      </fieldset>

      <TurnstileField onToken={setToken} />
      {error ? <FormError>{error}</FormError> : null}
      <SubmitButton loading={loading}>{mode === "sell" ? "Get my offer" : "Value my trade-in"}</SubmitButton>
      <p className="text-xs text-muted-foreground">{PRIVACY_MICROCOPY}</p>
    </form>
  );
}
