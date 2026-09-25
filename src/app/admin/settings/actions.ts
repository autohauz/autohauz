"use server";

import { revalidatePath } from "next/cache";
import { updateTags } from "@/lib/cache";
import { requirePermission } from "@/lib/security/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  businessAddressSchema,
  companyProfileSchema,
  financeParamsSchema,
  firstIssueMessage,
  invoiceSettingsSchema,
  locationHoursSchema,
  notificationRecipientsSchema,
  phoneNumbersSchema,
  socialLinksSchema,
} from "@/lib/validation/admin";

type ActionState = { ok?: boolean; error?: string };

async function upsertSetting(key: string, value: Record<string, unknown>): Promise<ActionState> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("settings").upsert(
    { key, value, updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
  if (error) return { error: error.message };
  updateTags("settings", "public");
  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function saveCompanyProfile(_prev: unknown, formData: FormData): Promise<ActionState> {
  await requirePermission("settings.manage");
  const parsed = companyProfileSchema.safeParse({
    legalName: formData.get("legalName") ?? "",
    tradingName: formData.get("tradingName") ?? "",
    abn: formData.get("abn") ?? "",
    email: formData.get("email") ?? "",
    googleRating: formData.get("googleRating") ?? "",
    googleReviewCount: formData.get("googleReviewCount") ?? "",
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };
  const d = parsed.data;
  return upsertSetting("company_profile", {
    legal_name: d.legalName,
    trading_name: d.tradingName,
    abn: d.abn ?? "",
    email: d.email ?? "",
    google_rating: d.googleRating ?? null,
    google_review_count: d.googleReviewCount ?? null,
  });
}

export async function savePhoneNumbers(_prev: unknown, formData: FormData): Promise<ActionState> {
  await requirePermission("settings.manage");
  const parsed = phoneNumbersSchema.safeParse({
    primary: formData.get("primary") ?? "",
    whatsapp: formData.get("whatsapp") ?? "",
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };
  return upsertSetting("phone_numbers", parsed.data);
}

export async function saveFinanceParams(_prev: unknown, formData: FormData): Promise<ActionState> {
  await requirePermission("settings.manage");
  const parsed = financeParamsSchema.safeParse({
    annualRate: formData.get("annualRate"),
    termMonths: formData.get("termMonths"),
    depositPct: formData.get("depositPct"),
    disclaimer: formData.get("disclaimer") ?? "",
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };
  const d = parsed.data;
  return upsertSetting("finance_params", {
    annual_rate: d.annualRate,
    term_months: d.termMonths,
    deposit_pct: d.depositPct,
    disclaimer: d.disclaimer,
  });
}

export async function saveNotificationRecipients(_prev: unknown, formData: FormData): Promise<ActionState> {
  await requirePermission("settings.manage");
  const emails = String(formData.get("emails") ?? "")
    .split(/[\n,]/)
    .map((e) => e.trim())
    .filter(Boolean);
  const parsed = notificationRecipientsSchema.safeParse({ emails });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };
  return upsertSetting("notification_recipients", parsed.data);
}

export async function saveLocationHours(_prev: unknown, formData: FormData): Promise<ActionState> {
  await requirePermission("settings.manage");
  const parsed = locationHoursSchema.safeParse(
    Object.fromEntries(["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => [d, formData.get(d) ?? ""])),
  );
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const supabase = createAdminClient();
  const { data: locations } = await supabase
    .from("locations")
    .select("id")
    .eq("is_active", true)
    .order("name")
    .limit(1);
  if (!locations || locations.length === 0) return { error: "No active locations found" };

  const { error } = await supabase.from("locations").update({ hours: parsed.data }).eq("id", locations[0].id);
  if (error) return { error: error.message };

  updateTags("locations", "public");
  revalidatePath("/admin/settings");
  revalidatePath("/contact");
  return { ok: true };
}

export async function saveBusinessAddress(_prev: unknown, formData: FormData): Promise<ActionState> {
  await requirePermission("settings.manage");
  const parsed = businessAddressSchema.safeParse({
    street: formData.get("street") ?? "",
    suburb: formData.get("suburb") ?? "",
    state: formData.get("state") ?? "",
    postcode: formData.get("postcode") ?? "",
    country: formData.get("country") || "Australia",
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };
  return upsertSetting("business_address", parsed.data);
}

export async function saveSocialLinks(_prev: unknown, formData: FormData): Promise<ActionState> {
  await requirePermission("settings.manage");
  const parsed = socialLinksSchema.safeParse(
    Object.fromEntries(["facebook", "instagram", "linkedin", "x", "youtube", "tiktok"].map((k) => [k, formData.get(k) ?? ""])),
  );
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };
  return upsertSetting("social_links", parsed.data);
}

export async function saveInvoiceSettings(_prev: unknown, formData: FormData): Promise<ActionState> {
  await requirePermission("settings.manage");
  const parsed = invoiceSettingsSchema.safeParse({
    gstEnabled: formData.get("gstEnabled") ?? false,
    gstRate: formData.get("gstRate") ?? "",
    pricesIncludeGst: formData.get("pricesIncludeGst") ?? false,
    numberPrefix: formData.get("numberPrefix") ?? "",
    dueDays: formData.get("dueDays") ?? "",
    paymentTerms: formData.get("paymentTerms") ?? "",
    footerNote: formData.get("footerNote") ?? "",
    bankAccountName: formData.get("bankAccountName") ?? "",
    bankBsb: formData.get("bankBsb") ?? "",
    bankAccountNumber: formData.get("bankAccountNumber") ?? "",
    payId: formData.get("payId") ?? "",
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };
  const d = parsed.data;
  return upsertSetting("invoice_settings", {
    gst_enabled: d.gstEnabled,
    gst_rate: d.gstRate,
    prices_include_gst: d.pricesIncludeGst,
    number_prefix: d.numberPrefix,
    due_days: d.dueDays,
    payment_terms: d.paymentTerms,
    footer_note: d.footerNote,
    bank_account_name: d.bankAccountName,
    bank_bsb: d.bankBsb,
    bank_account_number: d.bankAccountNumber,
    pay_id: d.payId,
  });
}
