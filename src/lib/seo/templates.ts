import { formatPrice } from "@/lib/nav";

/**
 * Title/description templates for the programmatic landing pages.
 *
 * All copy is Australian-English and geo-qualified with the dealership's real
 * trading location (Lansvale, in Sydney's west). Qualifying the title is what
 * makes these pages competitive for the "<thing> for sale <place>" queries
 * Australian car buyers actually type, instead of fighting national aggregators
 * on the bare head term.
 *
 * Titles omit the brand suffix — the root layout's title template appends
 * "| Cars365 Australia" — so keep them under ~45 characters of their own.
 */

const LOCATION = "Lansvale, NSW";

/**
 * Pluralises a body-type label for use in a heading.
 *
 * `BODY_TYPE_LABELS` holds singular display labels, some of which are compound
 * ("Ute / Pickup") or already read as plural-ish. Naive `${label}s` produced
 * "Used Ute / Pickups for Sale", so compound labels take only their first term.
 */
export function pluralBodyLabel(label: string): string {
  const head = label.split("/")[0].trim();
  return head.endsWith("s") ? head : `${head}s`;
}

export function makeTitle(make: string) {
  return `Used ${make} for Sale in ${LOCATION}`;
}

export function makeDescription(make: string) {
  return `Browse our range of quality used ${make} vehicles for sale in ${LOCATION}. Inspected, priced honestly, with finance and trade-ins available across Australia.`;
}

export function makeModelTitle(make: string, model: string) {
  return `Used ${make} ${model} for Sale in ${LOCATION}`;
}

export function makeModelDescription(make: string, model: string) {
  return `Find the best deals on used ${make} ${model} cars in Lansvale, Sydney. Every car is fully inspected and comes with a roadworthy certificate.`;
}

export function budgetTitle(budget: number) {
  return `Used Cars Under ${formatPrice(budget)} in Sydney, NSW`;
}

export function budgetDescription(budget: number) {
  return `Looking for reliable used cars under ${formatPrice(budget)}? Browse our inspected inventory in ${LOCATION}. Finance and trade-ins welcome.`;
}

export function bodyTypeTitle(body: string) {
  return `Used ${pluralBodyLabel(body)} for Sale in ${LOCATION}`;
}

export function bodyTypeDescription(body: string) {
  return `Browse quality used ${pluralBodyLabel(body).toLowerCase()} for sale in Lansvale, Sydney. Transparent pricing, roadworthy certificate included, finance and trade-ins available.`;
}
