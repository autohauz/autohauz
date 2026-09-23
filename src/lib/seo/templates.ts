import { formatPrice } from "@/lib/nav";
import { withRegion } from "@/config/seo";

/**
 * Title/description templates for the programmatic landing pages.
 *
 * Copy is Australian-English. A location qualifier ("in Parramatta, NSW") is
 * appended ONLY when `seo.regionPhrase` is configured — the dealership's real
 * premises are not yet known, and a made-up locality would be a false local
 * claim. Once configured, the qualifier is what makes these pages competitive
 * for the "<thing> for sale <place>" queries buyers actually type.
 *
 * Titles omit the brand suffix — the root layout's title template appends
 * "| AutoHauz" — so keep them under ~45 characters of their own.
 */

/**
 * Pluralises a body-type label for use in a heading.
 *
 * `BODY_TYPE_LABELS` holds singular display labels, some of which are compound
 * ("Ute / Pickup"). Naive `${label}s` produced "Used Ute / Pickups for Sale",
 * so compound labels take only their first term.
 */
export function pluralBodyLabel(label: string): string {
  const head = label.split("/")[0].trim();
  return head.endsWith("s") ? head : `${head}s`;
}

export function makeTitle(make: string) {
  return withRegion(`Used ${make} for Sale`);
}

export function makeDescription(make: string) {
  return `${withRegion(`Browse our range of quality used ${make} vehicles for sale`)}. Inspected, priced honestly, with finance and trade-ins available.`;
}

export function makeModelTitle(make: string, model: string) {
  return withRegion(`Used ${make} ${model} for Sale`);
}

export function makeModelDescription(make: string, model: string) {
  return `${withRegion(`Find quality used ${make} ${model} cars for sale`)}. Every car is inspected before listing, with transparent pricing and finance options.`;
}

export function budgetTitle(budget: number) {
  return withRegion(`Used Cars Under ${formatPrice(budget)}`);
}

export function budgetDescription(budget: number) {
  return `${withRegion(`Looking for a reliable used car under ${formatPrice(budget)}? Browse our inspected inventory`)}. Finance and trade-ins welcome.`;
}

export function bodyTypeTitle(body: string) {
  return withRegion(`Used ${pluralBodyLabel(body)} for Sale`);
}

export function bodyTypeDescription(body: string) {
  return `${withRegion(`Browse quality used ${pluralBodyLabel(body).toLowerCase()} for sale`)}. Transparent pricing, inspected vehicles, finance and trade-ins available.`;
}
