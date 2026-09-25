import { z } from "zod";
import { optionalAbnSchema } from "@/lib/validation/abn";

const MAX_CENTS = 10_000_000_00; // $10M — far above any single vehicle sale
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null));

export const invoiceItemSchema = z
  .object({
    id: z.string().uuid().optional(),
    description: z.string().trim().min(1, "Description is required").max(500, "Description is too long"),
    quantity: z.number().int().min(1, "Quantity must be at least 1").max(10_000),
    unitPriceCents: z.number().int().min(0, "Price cannot be negative").max(MAX_CENTS),
    discountCents: z.number().int().min(0, "Discount cannot be negative").max(MAX_CENTS),
    gstApplicable: z.boolean().default(true),
    sortOrder: z.number().int().min(0).max(1000),
  })
  .refine((i) => i.discountCents <= i.unitPriceCents * i.quantity, {
    message: "A line discount cannot exceed the line amount",
    path: ["discountCents"],
  });

export const invoiceBaseSchema = z.object({
  leadId: z.string().uuid().nullable().optional(),
  vehicleId: z.string().uuid().nullable().optional(),

  billingName: z.string().trim().min(1, "Billing name is required").max(200),
  billingEmail: z.string().trim().email("Invalid email").max(254).nullable().optional().or(z.literal("")),
  billingPhone: optionalText(40),
  billingAddress: optionalText(500),
  billingAbn: optionalAbnSchema.nullable(),

  dueDate: z.string().regex(isoDate, "Invalid due date").nullable().optional().or(z.literal("")),
  notes: optionalText(2000),
  paymentTerms: optionalText(2000),
  footerNote: optionalText(500),

  invoiceDiscountCents: z.number().int().min(0, "Discount cannot be negative").max(MAX_CENTS).default(0),
});

export const invoiceDraftSchema = invoiceBaseSchema.extend({
  items: z.array(invoiceItemSchema).max(100, "An invoice can have at most 100 lines"),
});

export type InvoiceDraftPayload = z.input<typeof invoiceDraftSchema>;

export const PAYMENT_METHODS = ["bank_transfer", "payid", "card", "cash", "cheque", "finance", "other"] as const;

export const PAYMENT_METHOD_LABELS: Record<(typeof PAYMENT_METHODS)[number], string> = {
  bank_transfer: "Bank transfer (EFT)",
  payid: "PayID / Osko",
  card: "Card",
  cash: "Cash",
  cheque: "Bank cheque",
  finance: "Finance payout",
  other: "Other",
};

export const invoicePaymentSchema = z.object({
  amountCents: z.number().int().min(1, "Amount must be greater than zero").max(MAX_CENTS),
  paymentDate: z.string().regex(isoDate, "Invalid payment date"),
  paymentMethod: z.enum(PAYMENT_METHODS, { message: "Choose a payment method" }),
  referenceNumber: optionalText(100),
  notes: optionalText(1000),
});

export type InvoicePaymentPayload = z.input<typeof invoicePaymentSchema>;
