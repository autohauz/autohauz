import { z } from "zod";

export const invoiceItemSchema = z.object({
  id: z.string().uuid().optional(),
  description: z.string().min(1, "Description is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  unitPriceCents: z.number().int().min(0, "Price cannot be negative"),
  discountCents: z.number().int().min(0, "Discount cannot be negative"),
  sortOrder: z.number().int(),
});

export const invoiceBaseSchema = z.object({
  leadId: z.string().uuid().nullable().optional(),
  vehicleId: z.string().uuid().nullable().optional(),
  
  billingName: z.string().min(1, "Billing name is required"),
  billingEmail: z.string().email("Invalid email").nullable().optional().or(z.literal("")),
  billingPhone: z.string().nullable().optional().or(z.literal("")),
  billingAddress: z.string().nullable().optional().or(z.literal("")),
  billingAbn: z.string().nullable().optional().or(z.literal("")),
  
  dueDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  paymentTerms: z.string().nullable().optional(),
  footerNote: z.string().nullable().optional(),
  
  invoiceDiscountCents: z.number().int().min(0, "Discount cannot be negative").default(0),
});

export const invoiceDraftSchema = invoiceBaseSchema.extend({
  items: z.array(invoiceItemSchema),
});

export type InvoiceDraftPayload = z.infer<typeof invoiceDraftSchema>;

export const invoicePaymentSchema = z.object({
  amountCents: z.number().int().min(1, "Amount must be greater than zero"),
  paymentDate: z.string(), // ISO date
  paymentMethod: z.string().min(1, "Payment method is required"),
  referenceNumber: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type InvoicePaymentPayload = z.infer<typeof invoicePaymentSchema>;
