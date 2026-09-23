import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FinanceParams } from "@/lib/domain";

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

export const getCompanyProfile = unstable_cache(
  async (): Promise<Record<string, unknown>> => {
    const supabase = createAdminClient();
    const { data } = await supabase.from("settings").select("value").eq("key", "company_profile").maybeSingle();
    return (data?.value ?? {}) as Record<string, unknown>;
  },
  ["company-profile"],
  { revalidate: 3600, tags: ["settings"] },
);

export const getPhoneNumbers = unstable_cache(
  async (): Promise<{ primary: string; whatsapp: string }> => {
    const supabase = createAdminClient();
    const { data } = await supabase.from("settings").select("value").eq("key", "phone_numbers").maybeSingle();
    const v = (data?.value ?? {}) as Record<string, unknown>;
    // No fallbacks: an unset number must render nothing, never another business's number.
    return { primary: String(v.primary ?? ""), whatsapp: String(v.whatsapp ?? "") };
  },
  ["phone-numbers"],
  { revalidate: 3600, tags: ["settings"] },
);
