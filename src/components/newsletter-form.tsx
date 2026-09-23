"use client";

import { useActionState, useId } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

type State = { ok: true } | { ok: false; error: string } | null;

async function subscribe(_prev: State, formData: FormData): Promise<State> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { ok: false, error: "Enter your email address." };
  try {
    const res = await fetch("/api/v1/newsletter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, consent: true, source: "footer" }),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      return { ok: false, error: json?.error?.message ?? "Could not subscribe. Please try again." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error. Please try again." };
  }
}

/** Newsletter signup; renders on a dark band so it uses semantic tokens only. */
export function NewsletterForm() {
  const [state, action, pending] = useActionState(subscribe, null);
  const id = useId();

  if (state?.ok) {
    return (
      <p role="status" className="inline-flex items-center gap-2 rounded-md border border-border bg-success-soft px-4 py-3 text-sm font-medium text-success">
        <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
        You&apos;re on the list. We&apos;ll email you when new cars arrive.
      </p>
    );
  }

  const error = state && !state.ok ? state.error : null;

  return (
    <form action={action} className="flex w-full flex-col gap-3 sm:flex-row" noValidate>
      <div className="flex-1">
        <label htmlFor={`${id}-email`} className="sr-only">Email address</label>
        <input
          id={`${id}-email`}
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="h-12 w-full rounded-md border border-input bg-white px-4 text-base text-navy-900 placeholder:text-ink-500 focus-visible:border-accent-bright"
        />
        {error ? (
          <p id={`${id}-error`} role="alert" className="mt-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-md bg-accent px-6 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        {pending ? "Subscribing…" : "Subscribe"}
      </button>
    </form>
  );
}
