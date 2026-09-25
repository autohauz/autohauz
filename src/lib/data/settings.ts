import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FinanceParams } from "@/lib/domain";
import { getBusinessProfile } from "@/lib/data/business";

/** Reads from the settings key/value store (SRS §15.7). */

const FINANCE_FALLBACK: FinanceParams = {
  annualRate: 8.99,
  termMonths: 60,
  depositPct: 10,
  disclaimer: "Indicative only, not an offer of finance.",
};

export const getFinanceParams = unstable_cache(
  async (): Promise<FinanceParams> => {
    const supabase = createAdminClient();
    const { data } = await supabase.from("settings").select("value").eq("key", "finance_params").maybeSingle();
    const v = (data?.value ?? {}) as Record<string, unknown>;
    return {
      annualRate: Number(v.annual_rate ?? FINANCE_FALLBACK.annualRate),
      termMonths: Number(v.term_months ?? FINANCE_FALLBACK.termMonths),
      depositPct: Number(v.deposit_pct ?? FINANCE_FALLBACK.depositPct),
      disclaimer: String(v.disclaimer ?? FINANCE_FALLBACK.disclaimer),
    };
  },
  ["finance-params"],
  { revalidate: 3600, tags: ["settings"] },
);

/**
 * Phone numbers for call / WhatsApp buttons. A view over the business profile
 * (Admin → Settings), so the header, footer, vehicle pages, JSON-LD and the
 * WhatsApp button always show the same numbers. It previously read the raw
 * settings row on its own, which was blank, so vehicle pages had no call or
 * WhatsApp buttons while the footer showed a number.
 */
export async function getPhoneNumbers(): Promise<{ primary: string; whatsapp: string }> {
  const business = await getBusinessProfile();
  return { primary: business.phone, whatsapp: business.whatsapp || business.phone };
}
