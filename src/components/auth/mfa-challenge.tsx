"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";

type Props = {
  mode: "verify" | "enrol";
  /** Verified TOTP factor to challenge (verify mode). */
  factorId: string | null;
};

type EnrolState = { factorId: string; qrSvg: string; secret: string } | null;

/**
 * TOTP enrolment + verification against Supabase Auth MFA.
 *
 * On success the session is upgraded to `aal2` and a full navigation reloads
 * server components so `requireAdmin()` sees the new assurance level.
 */
export function MfaChallenge({ mode, factorId }: Props) {
  const supabase = createClient();
  const [enrol, setEnrol] = useState<EnrolState>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Enrolment: ask Supabase for a new TOTP factor and show its QR code.
  useEffect(() => {
    if (mode !== "enrol" || enrol) return;
    let cancelled = false;
    (async () => {
      const { data, error: enrolError } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Authenticator app" });
      if (cancelled) return;
      if (enrolError || !data) {
        setError(enrolError?.message ?? "Could not start enrolment. Please try again.");
        return;
      }
      setEnrol({ factorId: data.id, qrSvg: data.totp.qr_code, secret: data.totp.secret });
    })();
    return () => {
      cancelled = true;
    };
    // `supabase` is a stable singleton per render tree; `enrol` guards re-runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const targetFactorId = mode === "verify" ? factorId : enrol?.factorId ?? null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!targetFactorId || code.length !== 6) return;
    setBusy(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: targetFactorId, code });
    if (verifyError) {
      setError(verifyError.message || "That code was not accepted. Check the time on your device and try again.");
      setBusy(false);
      return;
    }
    // Full navigation so the server picks up the aal2 session cookies.
    window.location.href = "/admin";
  }

  return (
    <>
    <form onSubmit={submit} className="space-y-5" noValidate>
      {mode === "enrol" ? (
        enrol ? (
          <div className="space-y-3 text-center">
            <div className="mx-auto w-44 rounded-lg border border-border bg-card p-2">
              {/* Supabase returns the otpauth QR as an SVG data URI. */}
              <Image src={enrol.qrSvg} alt="Authenticator QR code" width={160} height={160} unoptimized />
            </div>
            <p className="text-xs text-muted-foreground">
              Can&apos;t scan? Enter this key manually:{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm tracking-wider text-foreground">{enrol.secret}</code>
            </p>
          </div>
        ) : !error ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Preparing your QR code…
          </div>
        ) : null
      ) : null}

      <Field id="mfa-code" label="6-digit code">
        {(props) => (
          <Input
            {...props}
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="text-center font-mono text-2xl tracking-[0.4em]"
            disabled={busy || (mode === "enrol" && !enrol)}
            required
          />
        )}
      </Field>

      {error ? (
        <p id="mfa-error" role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={busy || code.length !== 6 || !targetFactorId}
        className="w-full"
      >
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        {mode === "verify" ? "Verify and continue" : "Activate and continue"}
      </Button>
    </form>

    <form action="/auth/sign-out" method="POST" className="mt-4 text-center">
      <Button variant="link" type="submit" className="text-muted-foreground">
        Sign out
      </Button>
    </form>
    </>
  );
}
