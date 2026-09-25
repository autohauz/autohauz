/**
 * Australian phone display. Settings ask for the number "as displayed", but a
 * number saved in E.164 (+61412345678) or as bare digits would otherwise show
 * raw on the site. Values that already contain spacing are the owner's chosen
 * format and are returned unchanged.
 */
export function formatPhoneForDisplay(raw: string): string {
  const value = raw.trim();
  if (/\s/.test(value)) return value;

  let digits = value.replace(/[^\d+]/g, "");
  if (digits.startsWith("+61")) digits = `0${digits.slice(3)}`;
  else if (digits.startsWith("61") && digits.length === 11) digits = `0${digits.slice(2)}`;
  if (!/^\d+$/.test(digits)) return value;

  // 1300 / 1800 numbers: 1300 123 456
  if (/^1[38]00\d{6}$/.test(digits)) return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  // 13 numbers: 13 12 34
  if (/^13\d{4}$/.test(digits)) return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4)}`;
  // Mobiles: 0412 345 678
  if (/^04\d{8}$/.test(digits)) return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  // Landlines: (02) 1234 5678
  if (/^0[2378]\d{8}$/.test(digits)) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)} ${digits.slice(6)}`;
  return value;
}

/** `tel:` URI for any stored format (spaces, brackets and dashes removed). */
export function telHref(raw: string): string {
  return `tel:${raw.replace(/[^\d+]/g, "")}`;
}
