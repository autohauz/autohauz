import { z } from "zod";
import { optionalAbnSchema } from "@/lib/validation/abn";

/** Admin: settings (per-key), redirects, lead pipeline actions. */

/** Empty form fields arrive as "" — treat as "not provided" for optional numbers. */
const optionalNumber = (schema: z.ZodNumber) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : v), z.coerce.number().pipe(schema).optional());

export const financeParamsSchema = z.object({
  annualRate: z.coerce.number().min(0).max(100),
  termMonths: z.coerce.number().int().min(1).max(120),
  depositPct: z.coerce.number().min(0).max(100),
  disclaimer: z.string().trim().min(10).max(1000),
});

export const companyProfileSchema = z.object({
  legalName: z.string().trim().max(200),
  tradingName: z.string().trim().max(200),
  abn: optionalAbnSchema,
  email: z.string().trim().email().max(160).optional().or(z.literal("")),
  // Only genuine, client-entered review figures. 0 / blank means "do not show".
  googleRating: optionalNumber(z.number().min(0).max(5)),
  googleReviewCount: optionalNumber(z.number().int().nonnegative()),
});

export const phoneNumbersSchema = z.object({
  primary: z.string().trim().max(40),
  // WhatsApp numbers are stored in E.164 digits without "+"; blank disables the button.
  whatsapp: z
    .string()
    .trim()
    .transform((v) => v.replace(/[^\d]/g, ""))
    .refine((v) => v === "" || (v.length >= 8 && v.length <= 15), "Enter the WhatsApp number in international format, digits only"),
});

export const notificationRecipientsSchema = z.object({
  emails: z.array(z.string().trim().email()).max(20),
});

const AU_STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"] as const;

/** Physical premises. All optional so the profile can be filled in progressively; rendering checks completeness. */
export const businessAddressSchema = z.object({
  street: z.string().trim().max(120),
  suburb: z.string().trim().max(80),
  state: z.preprocess((v) => (typeof v === "string" ? v.trim().toUpperCase() : v), z.enum(AU_STATES).or(z.literal(""))),
  postcode: z.string().trim().regex(/^(\d{4})?$/, "Postcode must be 4 digits"),
  country: z.string().trim().max(60).default("Australia"),
});

const optionalUrl = z
  .string()
  .trim()
  .refine((v) => v === "" || /^https?:\/\/[^\s]+$/i.test(v), "Enter a full URL starting with https://");

export const socialLinksSchema = z.object({
  facebook: optionalUrl,
  instagram: optionalUrl,
  linkedin: optionalUrl,
  x: optionalUrl,
  youtube: optionalUrl,
  tiktok: optionalUrl,
});

const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

/** Invoice defaults — financially sensitive, so every number is bounded. */
export const invoiceSettingsSchema = z.object({
  gstEnabled: checkbox,
  gstRate: z.coerce.number().min(0).max(100),
  pricesIncludeGst: checkbox,
  numberPrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{1,6}$/, "Prefix must be 1–6 letters or digits"),
  dueDays: z.coerce.number().int().min(0).max(365),
  paymentTerms: z.string().trim().max(500),
  footerNote: z.string().trim().max(500),
  bankAccountName: z.string().trim().max(120),
  bankBsb: z.string().trim().regex(/^(\d{3}-?\d{3})?$/, "BSB must be 6 digits (e.g. 062-000)"),
  bankAccountNumber: z.string().trim().regex(/^(\d{5,10})?$/, "Account number must be 5–10 digits"),
  payId: z.string().trim().max(120),
});

const dayHours = z.string().trim().max(40);
export const locationHoursSchema = z.object({
  mon: dayHours, tue: dayHours, wed: dayHours, thu: dayHours, fri: dayHours, sat: dayHours, sun: dayHours,
});

export const redirectSchema = z.object({
  id: z.string().uuid().optional(),
  fromPath: z.string().trim().startsWith("/").max(2048),
  toPath: z.string().trim().min(1).max(2048),
  code: z.coerce.number().int().refine((c) => [301, 302, 307, 308, 410].includes(c), {
    message: "code must be 301, 302, 307, 308, or 410",
  }),
});

/** Lead pipeline mutation (SRS §15.3). Loss reason required when marking lost. */
export const leadStatusUpdateSchema = z
  .object({
    leadId: z.string().uuid(),
    status: z.enum([
      "new", "contacted", "qualified", "inspection_scheduled",
      "negotiation", "won", "lost", "spam",
    ]),
    lossReason: z
      .enum(["price", "sold_elsewhere", "finance_declined", "unresponsive", "other"])
      .optional(),
  })
  .refine((d) => d.status !== "lost" || !!d.lossReason, {
    message: "A loss reason is required when marking a lead lost.",
    path: ["lossReason"],
  });

export const leadNoteSchema = z.object({
  leadId: z.string().uuid(),
  note: z.string().trim().min(1).max(4000),
});

export const leadAssignSchema = z.object({
  leadId: z.string().uuid(),
  assigneeId: z.string().uuid().nullable(),
});

export const leadReminderSchema = z.object({
  leadId: z.string().uuid(),
  dueAt: z.string().datetime(),
  note: z.string().trim().max(1000).optional(),
});

export const staffRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["owner", "admin", "manager", "sales", "content"]),
  active: z.boolean().optional().default(true),
});

export type FinanceParamsInput = z.infer<typeof financeParamsSchema>;
export type BusinessAddressInput = z.infer<typeof businessAddressSchema>;
export type SocialLinksInput = z.infer<typeof socialLinksSchema>;
export type InvoiceSettingsInput = z.infer<typeof invoiceSettingsSchema>;
export type CompanyProfileInput = z.infer<typeof companyProfileSchema>;
export type PhoneNumbersInput = z.infer<typeof phoneNumbersSchema>;
export type RedirectInput = z.infer<typeof redirectSchema>;
export type LeadStatusUpdateInput = z.infer<typeof leadStatusUpdateSchema>;

/** Turns a Zod failure into one human-readable line for a toast. */
export function firstIssueMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid input.";
  const path = issue.path.length ? `${issue.path.join(".")}: ` : "";
  return `${path}${issue.message}`;
}
