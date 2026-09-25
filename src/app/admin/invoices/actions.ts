"use server";

import { requirePermission } from "@/lib/security/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateTags } from "@/lib/cache";
import {
  invoiceDraftSchema,
  invoicePaymentSchema,
  type InvoiceDraftPayload,
  type InvoicePaymentPayload,
} from "@/lib/validation/invoice";
import { calculateInvoiceTotals } from "@/lib/invoices/calc";
import { sellerSnapshotFrom, taxInvoiceReadiness } from "@/lib/invoices/document";
import { getBusinessProfile } from "@/lib/data/business";
import { getInvoiceDetail, getVehicleSnapshot } from "@/lib/data/invoices";
import { renderInvoicePdf } from "@/lib/invoices/pdf";
import { sendInvoiceEmail } from "@/lib/email/invoice";

export type ActionState = { status: "idle" | "success" | "error"; message: string; id?: string };

type Supabase = ReturnType<typeof createAdminClient>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * SQLSTATEs raised by our own guards in the invoice migrations; their
 * messages are written for staff. Anything else is logged and replaced.
 */
const BUSINESS_RULE_CODES = new Set(["55000", "22003", "P0002", "22023", "23514"]);

function dbError(context: string, error: { code?: string; message: string } | null): ActionState {
  if (error?.code === "23514") {
    return { status: "error", message: "Some amounts are invalid. Check quantities, prices and discounts." };
  }
  if (error?.code && BUSINESS_RULE_CODES.has(error.code)) {
    return { status: "error", message: error.message };
  }
  console.error(`[invoices] ${context}:`, error?.message ?? "unknown error");
  return { status: "error", message: `Could not ${context}. Please try again.` };
}

async function logEvent(supabase: Supabase, invoiceId: string, event: string, actorId: string, data: Record<string, unknown> = {}) {
  const { error } = await supabase.from("invoice_events").insert({ invoice_id: invoiceId, actor_id: actorId, event, data });
  if (error) console.error(`[invoices] event "${event}" not recorded:`, error.message);
}

async function saveDraft(id: string | null, payload: InvoiceDraftPayload, actorId: string): Promise<ActionState> {
  const parsed = invoiceDraftSchema.safeParse(payload);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid invoice" };
  }
  const data = parsed.data;
  const settings = (await getBusinessProfile()).invoice;

  const totals = calculateInvoiceTotals({
    lines: data.items,
    invoiceDiscountCents: data.invoiceDiscountCents,
    settings,
  });

  // GST configuration is captured on the draft; it is frozen when issued.
  const header = {
    lead_id: data.leadId ?? null,
    vehicle_id: data.vehicleId ?? null,
    billing_name: data.billingName,
    billing_email: data.billingEmail || null,
    billing_phone: data.billingPhone,
    billing_address: data.billingAddress,
    billing_abn: data.billingAbn ?? null,
    gst_enabled: settings.gstEnabled,
    gst_rate: settings.gstRate,
    prices_include_gst: settings.pricesIncludeGst,
    subtotal_cents: totals.subtotalCents,
    line_discounts_cents: totals.lineDiscountsCents,
    invoice_discount_cents: totals.invoiceDiscountCents,
    net_ex_gst_cents: totals.netExGstCents,
    gst_cents: totals.gstCents,
    gst_free_cents: totals.gstFreeCents,
    total_inc_gst_cents: totals.totalIncGstCents,
    due_date: data.dueDate || null,
    notes: data.notes,
    payment_terms: data.paymentTerms ?? (id ? null : settings.paymentTerms),
    footer_note: data.footerNote ?? (id ? null : settings.footerNote || null),
  };
  const items = data.items.map((item, idx) => ({
    description: item.description,
    quantity: item.quantity,
    unit_price_cents: item.unitPriceCents,
    discount_cents: item.discountCents,
    gst_applicable: item.gstApplicable,
    sort_order: item.sortOrder ?? idx,
  }));

  // One transaction: header + items (migration 20260924100100).
  const supabase = createAdminClient();
  const { data: savedId, error } = await supabase.rpc("save_invoice_draft", {
    p_invoice_id: id,
    p_header: header,
    p_items: items,
  });
  if (error || !savedId) return dbError("save the draft", error);

  await logEvent(supabase, savedId as string, id ? "updated" : "created", actorId);
  updateTags("invoices");
  return { status: "success", message: id ? "Draft updated" : "Draft created", id: savedId as string };
}

export async function createInvoiceDraft(payload: InvoiceDraftPayload): Promise<ActionState> {
  const user = await requirePermission("invoices.write");
  return saveDraft(null, payload, user.id);
}

export async function updateInvoiceDraft(id: string, payload: InvoiceDraftPayload): Promise<ActionState> {
  const user = await requirePermission("invoices.write");
  if (!UUID.test(id)) return { status: "error", message: "Invoice not found" };
  return saveDraft(id, payload, user.id);
}

export async function issueInvoice(id: string): Promise<ActionState> {
  const user = await requirePermission("invoices.write");
  if (!UUID.test(id)) return { status: "error", message: "Invoice not found" };
  const supabase = createAdminClient();

  const { data: inv, error: readError } = await supabase
    .from("invoices")
    .select("status, gst_enabled, vehicle_id")
    .eq("id", id)
    .maybeSingle();
  if (readError) return dbError("load the invoice", readError);
  if (!inv) return { status: "error", message: "Invoice not found" };

  const profile = await getBusinessProfile();
  const seller = sellerSnapshotFrom(profile);
  const readiness = taxInvoiceReadiness(inv.gst_enabled, seller);
  if (!readiness.ok) return { status: "error", message: readiness.reason };

  const vehicle = inv.vehicle_id ? await getVehicleSnapshot(inv.vehicle_id) : null;

  // Atomic: conditional on status = 'draft', numbered and frozen in one
  // transaction, so a double click can never renumber an issued invoice.
  const { data: number, error } = await supabase.rpc("issue_invoice", {
    p_invoice_id: id,
    p_prefix: profile.invoice.numberPrefix,
    p_document_title: readiness.title,
    p_seller: seller,
    p_vehicle: vehicle,
  });
  if (error || !number) return dbError("issue the invoice", error);

  await logEvent(supabase, id, "issued", user.id, { invoice_number: number });
  updateTags("invoices");
  return { status: "success", message: `Invoice ${number} issued`, id };
}

export async function recordPayment(invoiceId: string, payload: InvoicePaymentPayload): Promise<ActionState> {
  const user = await requirePermission("invoices.write");
  if (!UUID.test(invoiceId)) return { status: "error", message: "Invoice not found" };
  const parsed = invoicePaymentSchema.safeParse(payload);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid payment" };

  // Status, balance and concurrency are enforced by the payment trigger.
  const supabase = createAdminClient();
  const { error } = await supabase.from("invoice_payments").insert({
    invoice_id: invoiceId,
    amount_cents: parsed.data.amountCents,
    payment_date: parsed.data.paymentDate,
    payment_method: parsed.data.paymentMethod,
    reference_number: parsed.data.referenceNumber,
    notes: parsed.data.notes,
    recorded_by: user.id,
  });
  if (error) return dbError("record the payment", error);

  await logEvent(supabase, invoiceId, "payment_recorded", user.id, {
    amount_cents: parsed.data.amountCents,
    method: parsed.data.paymentMethod,
  });
  updateTags("invoices");
  return { status: "success", message: "Payment recorded", id: invoiceId };
}

export async function voidInvoice(id: string, reason?: string): Promise<ActionState> {
  const user = await requirePermission("invoices.void");
  if (!UUID.test(id)) return { status: "error", message: "Invoice not found" };
  const supabase = createAdminClient();

  // Conditional update: only a voidable status moves; the DB transition
  // trigger rejects anything else.
  const { data, error } = await supabase
    .from("invoices")
    .update({ status: "void", voided_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["draft", "issued", "partially_paid"])
    .select("id");
  if (error) return dbError("void the invoice", error);
  if (!data || data.length === 0) {
    return { status: "error", message: "Only draft, issued or part-paid invoices can be voided." };
  }

  await logEvent(supabase, id, "voided", user.id, reason ? { reason: reason.slice(0, 500) } : {});
  updateTags("invoices");
  return { status: "success", message: "Invoice voided", id };
}

/** Emails the invoice PDF to the billing address (transactional, not marketing). */
export async function emailInvoice(id: string): Promise<ActionState> {
  const user = await requirePermission("invoices.write");
  if (!UUID.test(id)) return { status: "error", message: "Invoice not found" };

  const detail = await getInvoiceDetail(id);
  if (!detail) return { status: "error", message: "Invoice not found" };
  const { invoice } = detail;
  if (invoice.status === "draft" || invoice.status === "void") {
    return { status: "error", message: "Only issued invoices can be emailed." };
  }
  if (!invoice.billingEmail) {
    return { status: "error", message: "This invoice has no billing email address." };
  }

  const profile = await getBusinessProfile();
  let pdf: Buffer;
  try {
    pdf = await renderInvoicePdf(detail, profile);
  } catch (err) {
    console.error("[invoices] PDF render failed:", err instanceof Error ? err.message : err);
    return { status: "error", message: "Could not generate the PDF. Please try again." };
  }

  const result = await sendInvoiceEmail({ to: invoice.billingEmail, invoice, pdfBuffer: pdf });
  if (result.skipped) {
    return { status: "error", message: "Email is not configured (SMTP settings missing). Download the PDF instead." };
  }
  if (!result.ok) {
    return { status: "error", message: "The email could not be sent. Please try again." };
  }

  await logEvent(createAdminClient(), id, "emailed", user.id, { to: invoice.billingEmail });
  updateTags("invoices");
  return { status: "success", message: `Invoice emailed to ${invoice.billingEmail}`, id };
}
