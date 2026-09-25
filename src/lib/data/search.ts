/**
 * Makes free-text admin search safe to embed in a PostgREST filter string
 * (`.or("name.ilike.%q%,…")`). Commas, parentheses, quotes and backslashes
 * are filter syntax there, so they are replaced with spaces; LIKE wildcards
 * (`%`, `_`, `*`) are dropped so the input matches literally. Letters
 * (any script), digits, spaces and `@ . - ' +` survive — enough for names,
 * emails, phone numbers and invoice/stock numbers.
 */
export function sanitizeSearchTerm(raw: string | null | undefined, maxLength = 100): string {
  if (!raw) return "";
  return raw
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s@.\-'+]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}
