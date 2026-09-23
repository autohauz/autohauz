
/**
 * Layered anti-spam for public lead forms (SRS §9.20 / §20):
 * honeypot, minimum time-to-submit, and disposable-email soft flag.
 * Spam is quarantined silently (the client still sees success) so bots aren't
 * taught what tripped the filter.
 */

// Minimum plausible human fill time. Faster than this ⇒ almost certainly a bot.
const MIN_SUBMIT_MS = 2000;

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com",
  "trashmail.com", "yopmail.com", "sharklasers.com", "getnada.com",
  "throwawaymail.com", "temp-mail.org", "fakeinbox.com", "maildrop.cc",
]);

export type SpamVerdict = { isSpam: boolean; reason: string | null };

export function checkSpam(input: {
  website?: string; // honeypot — must be empty
  formRenderedAt?: number;
  email?: string;
}): SpamVerdict {
  // Honeypot filled ⇒ bot.
  if (input.website && input.website.trim().length > 0) {
    return { isSpam: true, reason: "honeypot" };
  }
  // Submitted implausibly fast ⇒ bot.
  if (typeof input.formRenderedAt === "number" && Number.isFinite(input.formRenderedAt)) {
    const elapsed = Date.now() - input.formRenderedAt;
    if (elapsed >= 0 && elapsed < MIN_SUBMIT_MS) {
      return { isSpam: true, reason: "too_fast" };
    }
  }
  // Disposable email ⇒ soft flag (still quarantine).
  if (input.email) {
    const domain = input.email.split("@")[1]?.toLowerCase().trim();
    if (domain && DISPOSABLE_DOMAINS.has(domain)) {
      return { isSpam: true, reason: "disposable_email" };
    }
  }
  return { isSpam: false, reason: null };
}

/** Best-effort E.164 normalization (defaults to AU when no country code given). */
export function normalizePhone(raw: string, defaultCc = "61"): string {
  const s = raw.replace(/[^\d+]/g, "");
  if (s.startsWith("+")) return s;
  if (s.startsWith("00")) return `+${s.slice(2)}`;
  if (s.startsWith("0")) return `+${defaultCc}${s.slice(1)}`;
  if (s.startsWith(defaultCc)) return `+${s}`;
  return `+${defaultCc}${s}`;
}

