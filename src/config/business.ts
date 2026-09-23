/**
 * Business profile — shape and BLANK defaults.
 *
 * The client has not yet supplied legal name, ABN, address, phone, hours or
 * social links (see docs/OPEN_DECISIONS.md D-05). Every field defaults to
 * empty, and every renderer treats "empty" as "do not show". Nothing in this
 * file may be a plausible-looking placeholder that could ship as fake data.
 *
 * Runtime values are read from the `settings` table by
 * `src/lib/data/business.ts::getBusinessProfile()`, which merges these
 * defaults with what staff enter in Admin → Settings.
 */

export type BusinessAddress = {
  street: string;
  suburb: string;
  state: string;
  postcode: string;
  country: string;
};

export type OpeningHours = Partial<Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", string>>;

export type SocialLinks = {
  facebook: string;
  instagram: string;
  linkedin: string;
  x: string;
  youtube: string;
  tiktok: string;
};

export type InvoiceSettings = {
  /** Charge GST on invoices. Default true (D-17); editable by staff. */
  gstEnabled: boolean;
  /** GST rate in percent. */
  gstRate: number;
  /** Whether entered unit prices already include GST. */
  pricesIncludeGst: boolean;
  /** Invoice-number prefix, e.g. "AH" → AH-2026-000001. */
  numberPrefix: string;
  /** Default days until due after issue. */
  dueDays: number;
  /** Default payment terms text printed on invoices. */
  paymentTerms: string;
  /** Free-text footer (e.g. "Thank you for your business"). */
  footerNote: string;
  /** Bank details printed for EFT payment. */
  bank: { accountName: string; bsb: string; accountNumber: string; payId: string };
};

export type BusinessProfile = {
  legalName: string;
  tradingName: string;
  abn: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: BusinessAddress;
  hours: OpeningHours;
  social: SocialLinks;
  invoice: InvoiceSettings;
  /** Genuine review figures only; both must be > 0 to be displayed anywhere. */
  googleRating: number | null;
  googleReviewCount: number | null;
};

export const businessDefaults: BusinessProfile = {
  legalName: "AutoHauz Pty Ltd",
  tradingName: "AutoHauz",
  abn: "",
  email: "info@jashire.com.au",
  phone: "+61492962418",
  whatsapp: "+61492962418",
  address: { street: "14 Harvey Rd", suburb: "Kings Park", state: "NSW", postcode: "2148", country: "Australia" },
  hours: {},
  social: { facebook: "", instagram: "", linkedin: "", x: "", youtube: "", tiktok: "" },
  invoice: {
    gstEnabled: true,
    gstRate: 10,
    pricesIncludeGst: true,
    numberPrefix: "AH",
    dueDays: 7,
    paymentTerms: "Payment is due within 7 days of the invoice date.",
    footerNote: "",
    bank: { accountName: "", bsb: "", accountNumber: "", payId: "" },
  },
  googleRating: null,
  googleReviewCount: null,
};

/** True when enough of an address exists to print or map it. */
export function hasAddress(a: BusinessAddress): boolean {
  return Boolean(a.street && a.suburb && a.state);
}

/** Single-line postal address, or "" when incomplete. */
export function formatAddress(a: BusinessAddress): string {
  if (!hasAddress(a)) return "";
  return [a.street, `${a.suburb} ${a.state} ${a.postcode}`.trim(), a.country].filter(Boolean).join(", ");
}

/** True when the business has genuine review figures worth showing. */
export function hasReviews(p: Pick<BusinessProfile, "googleRating" | "googleReviewCount">): boolean {
  return (p.googleRating ?? 0) > 0 && (p.googleReviewCount ?? 0) > 0;
}
