import { env } from "@/lib/env";

export async function verifyTurnstile(token?: string, ip?: string) {
  // `TURNSTILE_SECRET_KEY` is the documented name (.env.example). The code used
  // to read `TURNSTILE_SECRET`, which was never set, so production rejected
  // every form. The legacy name is still honoured for one release.
  const secret = env.TURNSTILE_SECRET_KEY ?? process.env.TURNSTILE_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production" && env.TURNSTILE_SKIP !== "true") {
      return { ok: false, skipped: false };
    }
    return { ok: true, skipped: true };
  }

  if (!token) {
    return { ok: false, skipped: false };
  }

  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);

  if (ip) {
    body.append("remoteip", ip);
  }

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body,
    },
  );
  const payload = (await response.json()) as { success?: boolean };
  const ok = payload.success === true;

  return { ok, skipped: false };
}
