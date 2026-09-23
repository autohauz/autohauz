import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { businessDefaults, type BusinessProfile, type InvoiceSettings, type OpeningHours } from "@/config/business";

/**
 * The business profile as staff configured it in Admin → Settings, layered
 * over the blank defaults in `src/config/business.ts`.
 *
 * Settings rows read (all optional):
 *   company_profile   { legal_name, trading_name, abn, email, google_rating, google_review_count }
 *   phone_numbers     { primary, whatsapp }
 *   business_address  { street, suburb, state, postcode, country }
 *   social_links      { facebook, instagram, linkedin, x, youtube, tiktok }
 *   invoice_settings  { gst_enabled, gst_rate, prices_include_gst, number_prefix, due_days,
 *                       payment_terms, footer_note, bank_account_name, bank_bsb, bank_account_number, pay_id }
 * Opening hours come from the first active `locations` row (existing behaviour).
 *
 * Cached for an hour and busted by the `settings`/`locations` tags that the
 * settings Server Actions update.
 */

type Row = Record<string, unknown>;
const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v.trim() : fallback);
const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === "boolean" ? v : fallback);
const positive = (v: unknown): number | null => (typeof v === "number" && v > 0 ? v : null);

export const getBusinessProfile = unstable_cache(
  async (): Promise<BusinessProfile> => {
    const supabase = createAdminClient();
    const [{ data: rows }, { data: location }] = await Promise.all([
      supabase
        .from("settings")
        .select("key, value")
        .in("key", ["company_profile", "phone_numbers", "business_address", "social_links", "invoice_settings"]),
      supabase.from("locations").select("hours").eq("is_active", true).order("name").limit(1).maybeSingle(),
    ]);

    const byKey = new Map<string, Row>((rows ?? []).map((r) => [r.key as string, (r.value ?? {}) as Row]));
    const company = byKey.get("company_profile") ?? {};
    const phones = byKey.get("phone_numbers") ?? {};
    const address = byKey.get("business_address") ?? {};
    const social = byKey.get("social_links") ?? {};
    const inv = byKey.get("invoice_settings") ?? {};
    const d = businessDefaults;

    const invoice: InvoiceSettings = {
      gstEnabled: bool(inv.gst_enabled, d.invoice.gstEnabled),
      gstRate: num(inv.gst_rate, d.invoice.gstRate),
      pricesIncludeGst: bool(inv.prices_include_gst, d.invoice.pricesIncludeGst),
      numberPrefix: str(inv.number_prefix, d.invoice.numberPrefix) || d.invoice.numberPrefix,
      dueDays: num(inv.due_days, d.invoice.dueDays),
      paymentTerms: str(inv.payment_terms, d.invoice.paymentTerms),
      footerNote: str(inv.footer_note, d.invoice.footerNote),
      bank: {
        accountName: str(inv.bank_account_name),
        bsb: str(inv.bank_bsb),
        accountNumber: str(inv.bank_account_number),
        payId: str(inv.pay_id),
      },
    };

    const cleanPhone = (val: unknown, fallback: string) => {
      const s = str(val);
      if (!s || /365|car\s*365/i.test(s)) return fallback;
      return s;
    };

    const cleanEmail = (val: unknown, fallback: string) => {
      const s = str(val);
      if (!s || /car365|cars365/i.test(s)) return fallback;
      return s;
    };

    return {
      legalName: str(company.legal_name, d.legalName) || d.legalName,
      tradingName: str(company.trading_name, d.tradingName) || d.tradingName,
      abn: str(company.abn),
      email: cleanEmail(company.email, d.email),
      phone: cleanPhone(phones.primary, d.phone),
      whatsapp: cleanPhone(phones.whatsapp, d.whatsapp),
      address: {
        street: str(address.street, d.address.street) || d.address.street,
        suburb: str(address.suburb, d.address.suburb) || d.address.suburb,
        state: str(address.state, d.address.state) || d.address.state,
        postcode: str(address.postcode, d.address.postcode) || d.address.postcode,
        country: str(address.country, d.address.country) || d.address.country,
      },
      hours: ((location?.hours as OpeningHours | null) ?? {}) as OpeningHours,
      social: {
        facebook: str(social.facebook),
        instagram: str(social.instagram),
        linkedin: str(social.linkedin),
        x: str(social.x),
        youtube: str(social.youtube),
        tiktok: str(social.tiktok),
      },
      invoice,
      googleRating: positive(company.google_rating),
      googleReviewCount: positive(company.google_review_count),
    };
  },
  ["business-profile"],
  { revalidate: 3600, tags: ["settings", "locations"] },
);
