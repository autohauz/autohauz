"use server";

import { requireAdminRole } from "@/lib/security/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateTags } from "@/lib/cache";
import { invoiceDraftSchema, invoicePaymentSchema, type InvoiceDraftPayload, type InvoicePaymentPayload } from "@/lib/validation/invoice";
import { calculateInvoiceTotals } from "@/lib/invoices/calc";
import { getBusinessProfile } from "@/lib/data/business";
import { assertValidTransition } from "@/lib/invoices/state-machine";

export type ActionState = { status: "idle" | "success" | "error"; message: string; id?: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function logEvent(supabase: any, invoiceId: string, event: string, actorId: string, data: any = {}) {
  await supabase.from("invoice_events").insert({
    invoice_id: invoiceId,
    actor_id: actorId,
    event,
    data,
  });
}

export async function createInvoiceDraft(payload: InvoiceDraftPayload): Promise<ActionState> {
  const user = await requireAdminRole(["owner", "admin", "manager", "sales"]);
  
  const parsed = invoiceDraftSchema.safeParse(payload);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0].message };
  }

  const data = parsed.data;
  const business = await getBusinessProfile();
  const settings = business.invoice;

  const totals = calculateInvoiceTotals({
    lines: data.items,
    invoiceDiscountCents: data.invoiceDiscountCents,
    settings,
  });

  const supabase = createAdminClient();

  const { data: inv, error } = await supabase.from("invoices").insert({
    status: "draft",
    lead_id: data.leadId || null,
    vehicle_id: data.vehicleId || null,
    billing_name: data.billingName,
    billing_email: data.billingEmail || null,
    billing_phone: data.billingPhone || null,
    billing_address: data.billingAddress || null,
    billing_abn: data.billingAbn || null,
    gst_enabled: settings.gstEnabled,
    gst_rate: settings.gstRate,
    prices_include_gst: settings.pricesIncludeGst,
    subtotal_cents: totals.subtotalCents,
    line_discounts_cents: totals.lineDiscountsCents,
    invoice_discount_cents: totals.invoiceDiscountCents,
    net_ex_gst_cents: totals.netExGstCents,
    gst_cents: totals.gstCents,
    total_inc_gst_cents: totals.totalIncGstCents,
    due_date: data.dueDate || null,
    notes: data.notes || null,
    payment_terms: data.paymentTerms || settings.paymentTerms,
    footer_note: data.footerNote || settings.footerNote,
  }).select("id").single();

  if (error || !inv) return { status: "error", message: error?.message || "Failed to create invoice" };

  if (data.items.length > 0) {
    const itemsData = data.items.map((item, idx) => ({
      invoice_id: inv.id,
      description: item.description,
      quantity: item.quantity,
      unit_price_cents: item.unitPriceCents,
      discount_cents: item.discountCents,
      sort_order: item.sortOrder ?? idx,
    }));
    await supabase.from("invoice_items").insert(itemsData);
  }

  await logEvent(supabase, inv.id, "created", user.id);
  updateTags("invoices");

  return { status: "success", message: "Draft created successfully", id: inv.id };
}

export async function updateInvoiceDraft(id: string, payload: InvoiceDraftPayload): Promise<ActionState> {
  const user = await requireAdminRole(["owner", "admin", "manager", "sales"]);
  
  const parsed = invoiceDraftSchema.safeParse(payload);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0].message };
  }
  
  const supabase = createAdminClient();
  const { data: existing } = await supabase.from("invoices").select("status").eq("id", id).single();
  if (!existing || existing.status !== "draft") {
    return { status: "error", message: "Only drafts can be updated" };
  }

  const data = parsed.data;
  const business = await getBusinessProfile();
  const settings = business.invoice;

  const totals = calculateInvoiceTotals({
    lines: data.items,
    invoiceDiscountCents: data.invoiceDiscountCents,
    settings,
  });

  const { error } = await supabase.from("invoices").update({
    lead_id: data.leadId || null,
    vehicle_id: data.vehicleId || null,
    billing_name: data.billingName,
    billing_email: data.billingEmail || null,
    billing_phone: data.billingPhone || null,
    billing_address: data.billingAddress || null,
    billing_abn: data.billingAbn || null,
    subtotal_cents: totals.subtotalCents,
    line_discounts_cents: totals.lineDiscountsCents,
    invoice_discount_cents: totals.invoiceDiscountCents,
    net_ex_gst_cents: totals.netExGstCents,
    gst_cents: totals.gstCents,
    total_inc_gst_cents: totals.totalIncGstCents,
    due_date: data.dueDate || null,
    notes: data.notes || null,
    payment_terms: data.paymentTerms || null,
    footer_note: data.footerNote || null,
  }).eq("id", id);

  if (error) return { status: "error", message: error.message };

  await supabase.from("invoice_items").delete().eq("invoice_id", id);
  if (data.items.length > 0) {
    const itemsData = data.items.map((item, idx) => ({
      invoice_id: id,
      description: item.description,
      quantity: item.quantity,
      unit_price_cents: item.unitPriceCents,
      discount_cents: item.discountCents,
      sort_order: item.sortOrder ?? idx,
    }));
    await supabase.from("invoice_items").insert(itemsData);
  }

  await logEvent(supabase, id, "updated", user.id);
  updateTags("invoices");

  return { status: "success", message: "Draft updated successfully", id };
}

export async function issueInvoice(id: string): Promise<ActionState> {
  const user = await requireAdminRole(["owner", "admin", "manager", "sales"]);
  const supabase = createAdminClient();
  
  const { data: inv } = await supabase.from("invoices").select("status").eq("id", id).single();
  if (!inv) return { status: "error", message: "Invoice not found" };
  
  try {
    assertValidTransition(inv.status as import("@/lib/domain").InvoiceStatus, "issued");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    return { status: "error", message: e.message };
  }

  const business = await getBusinessProfile();
  
  // Call next_invoice_number via RPC
  const { data: numberData, error: rpcError } = await supabase.rpc("next_invoice_number", { p_prefix: business.invoice.numberPrefix });
  if (rpcError) return { status: "error", message: "Failed to generate invoice number" };

  const { error } = await supabase.from("invoices").update({
    status: "issued",
    invoice_number: numberData,
    issued_at: new Date().toISOString(),
  }).eq("id", id);

  if (error) return { status: "error", message: error.message };

  await logEvent(supabase, id, "issued", user.id, { invoice_number: numberData });
  updateTags("invoices");

  return { status: "success", message: "Invoice issued successfully", id };
}

export async function recordPayment(invoiceId: string, payload: InvoicePaymentPayload): Promise<ActionState> {
  const user = await requireAdminRole(["owner", "admin", "manager", "sales"]);
  const parsed = invoicePaymentSchema.safeParse(payload);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message };
  
  const supabase = createAdminClient();
  const { error } = await supabase.from("invoice_payments").insert({
    invoice_id: invoiceId,
    amount_cents: parsed.data.amountCents,
    payment_date: parsed.data.paymentDate,
    payment_method: parsed.data.paymentMethod,
    reference_number: parsed.data.referenceNumber || null,
    notes: parsed.data.notes || null,
    recorded_by: user.id,
  });

  if (error) return { status: "error", message: error.message };

  await logEvent(supabase, invoiceId, "payment_recorded", user.id, { amount_cents: parsed.data.amountCents });
  updateTags("invoices");

  return { status: "success", message: "Payment recorded successfully", id: invoiceId };
}

export async function voidInvoice(id: string): Promise<ActionState> {
  const user = await requireAdminRole(["owner", "admin", "manager"]); // Restrict void to higher roles
  const supabase = createAdminClient();
  
  const { data: inv } = await supabase.from("invoices").select("status").eq("id", id).single();
  if (!inv) return { status: "error", message: "Invoice not found" };
  
  try {
    assertValidTransition(inv.status as import("@/lib/domain").InvoiceStatus, "void");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    return { status: "error", message: e.message };
  }

  const { error } = await supabase.from("invoices").update({
    status: "void",
    voided_at: new Date().toISOString(),
  }).eq("id", id);

  if (error) return { status: "error", message: error.message };

  await logEvent(supabase, id, "voided", user.id);
  updateTags("invoices");

  return { status: "success", message: "Invoice voided successfully", id };
}
