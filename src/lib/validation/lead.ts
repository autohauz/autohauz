import { z } from "zod";

/**
 * Public lead-capture validation (SRS §9.7–9.15, §19.2).
 *
 * One discriminated union over `type` covers all 8 lead kinds so a single
 * POST /api/v1/leads route can validate every form. The shared base carries
 * contact + attribution + anti-spam fields (honeypot, time-to-submit,
 * Turnstile) that every form posts.
 */

// Loose phone check here; the server normalizes to E.164 before persisting.
const phone = z.string().trim().min(8).max(30);
const name = z.string().trim().min(2).max(120);
const optionalEmail = z.string().trim().email().max(160).optional().or(z.literal(""));
const message = z.string().trim().max(2000).optional();

// Attribution + anti-spam envelope posted by every form.
const leadEnvelope = z.object({
  name,
  phone,
  email: optionalEmail,
  message,
  consent: z.boolean().optional(),
  // Anti-spam (SRS §9.20): honeypot is accepted (any value) so a bot that fills
  // it still gets a silent success — the server quarantines it as spam rather
  // than returning a validation error that teaches the bot what tripped it.
  // formRenderedAt drives the minimum time-to-submit check.
  website: z.string().optional(), // honeypot
  formRenderedAt: z.number().int().optional(),
  turnstileToken: z.string().optional(),
  // Attribution captured client-side.
  meta: z
    .object({
      sourceUrl: z.string().max(2048).optional(),
      referrer: z.string().max(2048).optional(),
      utm: z.record(z.string(), z.string()).optional(),
      device: z.enum(["mobile", "desktop", "tablet", "unknown"]).optional(),
    })
    .optional(),
});

const condition = z.enum(["excellent", "good", "fair", "poor"]);

export const vehicleEnquirySchema = leadEnvelope.extend({
  type: z.literal("vehicle_enquiry"),
  vehicleId: z.string().uuid(),
});

export const inspectionSchema = leadEnvelope.extend({
  type: z.literal("inspection"),
  vehicleId: z.string().uuid(),
  preferredDate: z.string().date(),
  preferredTime: z.enum(["morning", "afternoon", "evening"]),
});

export const financeSchema = leadEnvelope.extend({
  type: z.literal("finance"),
  vehicleId: z.string().uuid().optional(),
  email: z.string().trim().email().max(160), // required for finance
  employmentStatus: z.string().trim().max(80).optional(),
  residencyStatus: z.string().trim().max(80).optional(),
  depositAmount: z.coerce.number().nonnegative().optional(),
  weeklyBudget: z.coerce.number().nonnegative().optional(),
  // Finance data sharing requires explicit consent.
  consent: z.literal(true),
});

export const tradeInSchema = leadEnvelope.extend({
  type: z.literal("trade_in"),
  vehicleId: z.string().uuid().optional(), // target vehicle if from a VDP
  tradeMake: z.string().trim().min(1).max(80),
  tradeModel: z.string().trim().min(1).max(80),
  tradeYear: z.coerce.number().int().min(1950).max(2100),
  tradeMileageKm: z.coerce.number().int().nonnegative(),
  tradeCondition: condition.optional(),
  registration: z.string().trim().max(20).optional(),
  expectedPrice: z.coerce.number().nonnegative().optional(),
  photoMediaIds: z.array(z.string().uuid()).max(8).optional(),
});

export const sellYourCarSchema = leadEnvelope.extend({
  type: z.literal("sell"),
  make: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(80),
  year: z.coerce.number().int().min(1950).max(2100),
  mileageKm: z.coerce.number().int().nonnegative(),
  condition: condition,
  registration: z.string().trim().max(20).optional(),
  expectedPrice: z.coerce.number().nonnegative().optional(),
  preferredContact: z.enum(["call", "whatsapp"]).optional(),
  photoMediaIds: z.array(z.string().uuid()).max(8).optional(),
});

export const callbackSchema = leadEnvelope.extend({
  type: z.literal("callback"),
  vehicleId: z.string().uuid().optional(),
  preferredTime: z.string().trim().max(80).optional(),
});

export const generalEnquirySchema = leadEnvelope.extend({
  type: z.literal("general"),
  subject: z.enum(["general", "buying", "selling", "finance", "feedback"]).optional(),
});

export const leadSchema = z.discriminatedUnion("type", [
  vehicleEnquirySchema,
  inspectionSchema,
  financeSchema,
  tradeInSchema,
  sellYourCarSchema,
  callbackSchema,
  generalEnquirySchema,
]);

export type LeadInput = z.infer<typeof leadSchema>;
