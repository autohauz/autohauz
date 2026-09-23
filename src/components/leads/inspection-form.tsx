"use client";

import { useEffect, useRef, useState } from "react";
import { Field, TextInput, TextArea, Select, Honeypot, TurnstileField, SubmitButton, LeadSuccess, FormError, PRIVACY_MICROCOPY, PHONE_PATTERN } from "@/components/leads/lead-form-kit";
import { submitLead } from "@/lib/leads/submit";

/** Book-an-inspection request. This is a request, not a confirmed booking. */
export function InspectionForm({ vehicleId, phone, whatsappUrl }: { vehicleId: string; phone?: string | null; whatsappUrl?: string | null }) {
  const [name, setName] = useState("");
  const [phoneVal, setPhoneVal] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("morning");
  const [notes, setNotes] = useState("");
  const [website, setWebsite] = useState("");
  const [token, setToken] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const renderedAt = useRef(0);
  useEffect(() => {
    renderedAt.current = Date.now();
  }, []);

  // Min tomorrow, max +30 days.
  const [minDate, maxDate] = (() => {
    const now = new Date();
    const min = new Date(now);
    min.setDate(min.getDate() + 1);
    const max = new Date(now);
    max.setDate(max.getDate() + 30);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    return [fmt(min), fmt(max)];
  })();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await submitLead({
      type: "inspection",
      vehicleId,
      name,
      phone: phoneVal,
      preferredDate,
      preferredTime,
      message: notes,
      website,
      formRenderedAt: renderedAt.current,
      turnstileToken: token,
    });
    setLoading(false);
    if (res.ok) setDone(true);
    else setError(res.error);
  }

  if (done) return <LeadSuccess heading="Inspection requested — we'll confirm your time." phone={phone} whatsappUrl={whatsappUrl} />;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Honeypot value={website} onChange={setWebsite} />
      <Field label="Name" required>
        {(c) => <TextInput {...c} value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" disabled={loading} />}
      </Field>
      <Field label="Phone" required>
        {(c) => (
          <TextInput
            {...c}
            value={phoneVal}
            onChange={(e) => setPhoneVal(e.target.value)}
            required
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="04XX XXX XXX"
            pattern={PHONE_PATTERN}
            disabled={loading}
          />
        )}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Preferred date" required>
          {(c) => <TextInput {...c} type="date" min={minDate} max={maxDate} value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} required disabled={loading} />}
        </Field>
        <Field label="Time" required>
          {(c) => (
            <Select {...c} value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)} disabled={loading}>
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="evening">Evening</option>
            </Select>
          )}
        </Field>
      </div>
      <Field label="Notes">{(c) => <TextArea {...c} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything we should know?" disabled={loading} />}</Field>
      <TurnstileField onToken={setToken} />
      {error ? <FormError>{error}</FormError> : null}
      <SubmitButton loading={loading}>Request inspection</SubmitButton>
      <p className="text-xs text-muted-foreground">We&apos;ll confirm your time by phone or WhatsApp. {PRIVACY_MICROCOPY}</p>
    </form>
  );
}
