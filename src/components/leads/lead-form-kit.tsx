"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import { AlertCircle, Check, Phone, MessageCircle } from "lucide-react";
import { Field as UiField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select as UiSelect } from "@/components/ui/select";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPhoneForDisplay, telHref } from "@/lib/phone";

/*
 * Shared pieces for every lead form (enquiry, inspection, finance, sell,
 * trade-in, contact). Built on the DESIGN.md §6 primitives so the forms are
 * consistent: visible labels, 44 px controls on phones, errors announced,
 * `autocomplete` on personal-data fields.
 */

type Control = {
  id: string;
  "aria-describedby": string | undefined;
  "aria-invalid": true | undefined;
  "aria-required": true | undefined;
};

/** Labelled field; `children` receives the id/aria wiring to spread onto the control. */
export function Field({
  label,
  required,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: (control: Control) => ReactNode;
}) {
  const id = useId();
  return (
    <UiField id={id} label={label} required={required} hint={hint} error={error} className={className}>
      {children}
    </UiField>
  );
}

export const TextInput = Input;
export const TextArea = Textarea;
export const Select = UiSelect;

/** Off-screen honeypot. Real users never fill it; bots often do. */
export function Honeypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div aria-hidden className="absolute left-[-9999px] top-auto h-0 w-0 overflow-hidden" tabIndex={-1}>
      <label>
        Website
        <input type="text" tabIndex={-1} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  );
}

export function ConsentCheckbox({
  checked,
  onChange,
  error,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  /** Shown under the box and linked to it, so the reason is announced on focus. */
  error?: string | null;
  children: ReactNode;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div>
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="mt-0.5 size-5 shrink-0 rounded-sm border-input accent-accent"
        />
        <label htmlFor={id} className="text-sm leading-snug text-body">
          {children}
        </label>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 pl-8 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Renders the Turnstile widget only when configured (skipped in dev). */
export function TurnstileField({ onToken }: { onToken: (token: string) => void }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey) return null;
  return <Turnstile siteKey={siteKey} onSuccess={onToken} options={{ size: "flexible" }} />;
}

/** Submission error — announced, and says what to do next. */
export function FormError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft px-3 py-2.5 text-sm text-danger">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

export function SubmitButton({ loading, children }: { loading: boolean; children: ReactNode }) {
  return (
    <Button type="submit" size="cta" className="w-full" loading={loading}>
      {loading ? "Sending…" : children}
    </Button>
  );
}

/** Inline thank-you state that replaces the form on success. */
export function LeadSuccess({
  heading = "Thanks — we've got your enquiry.",
  phone,
  whatsappUrl,
}: {
  heading?: string;
  phone?: string | null;
  whatsappUrl?: string | null;
}) {
  // The form this replaces held focus; move it to the confirmation so keyboard
  // and screen-reader users land on the result instead of the page body.
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div role="status" className="rounded-lg border border-success/30 bg-success-soft p-6 text-center">
      <div className="mx-auto mb-3 inline-flex size-12 items-center justify-center rounded-full bg-success text-white" aria-hidden="true">
        <Check className="size-6" />
      </div>
      <h3 ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-foreground focus:outline-none">
        {heading}
      </h3>
      <p className="mt-1 text-sm text-body">We&apos;ll get back to you as soon as we can during business hours.</p>
      {phone || whatsappUrl ? (
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          {phone ? (
            <a href={telHref(phone)} className={cn(buttonVariants({ variant: "outline" }))}>
              <Phone aria-hidden="true" /> Call {formatPhoneForDisplay(phone)}
            </a>
          ) : null}
          {whatsappUrl ? (
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: "outline" }))}>
              <MessageCircle aria-hidden="true" /> WhatsApp us
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export const PRIVACY_MICROCOPY = "We only use your details to contact you about this enquiry.";

/** Australian mobile/landline characters; the server does the real validation. */
export const PHONE_PATTERN = "[0-9\\s\\+\\-\\(\\)]+";
