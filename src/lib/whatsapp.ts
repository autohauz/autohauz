/**
 * WhatsApp helpers — phone normalisation and click-to-chat link building.
 */

/**
 * Normalises a phone number to the international digits-only form wa.me
 * expects (no "+", no spaces). Australian numbers in any common form become
 * 61 + national number without the trunk 0:
 *
 *   "0412 345 678"      → "61412345678"
 *   "+61 412 345 678"   → "61412345678"
 *   "+61 (0) 412 345 678", "+61 0412…" → "61412345678"  (stray trunk 0)
 *   "0061 412 345 678"  → "61412345678"                  (international prefix)
 *   "412 345 678"       → "61412345678"                  (national number, no 0)
 *   "(02) 9876 5432"    → "61298765432"
 * Numbers with another country code ("+64 21 …") are kept as given.
 */
export function normaliseWhatsAppNumber(raw: string): string {
  const trimmed = raw.trim();
  let digits = trimmed.replace(/\D/g, "");

  // International dialling prefix from Australia.
  if (digits.startsWith("0011")) digits = digits.slice(4);
  else if (digits.startsWith("00")) digits = digits.slice(2);

  if (digits.startsWith("61")) {
    const national = digits.slice(2).replace(/^0+/, ""); // "+61 (0)4…" → drop the trunk 0
    return `61${national}`;
  }

  // Australian national formats: trunk 0 + 9 digits, or the 9 digits alone.
  if (/^0[2-478]\d{8}$/.test(digits)) return `61${digits.slice(1)}`;
  if (!trimmed.startsWith("+") && /^[2-478]\d{8}$/.test(digits)) return `61${digits}`;

  // Anything else already carries its own country code.
  return digits;
}

/**
 * Build a wa.me click-to-chat URL with an optional pre-filled message.
 */
export function buildWhatsAppUrl(phone: string, message?: string): string {
  const number = normaliseWhatsAppNumber(phone);
  const base = `https://wa.me/${number}`;
  if (!message) return base;
  return `${base}?text=${encodeURIComponent(message)}`;
}
