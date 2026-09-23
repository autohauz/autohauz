/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from "@/lib/supabase/admin";
import type { Invoice, InvoiceItem, InvoicePayment, InvoiceEvent, InvoiceStatus } from "@/lib/domain";
import { unstable_cache } from "next/cache";

export type InvoiceListRow = Invoice & {
  leadName?: string | null;
  vehicleTitle?: string | null;
  isOverdue: boolean;
};

export type InvoicesKPIs = {
  totalInvoicedCents: number;
  totalPaidCents: number;
  totalOutstandingCents: number;
  overdueCount: number;
};

const INVOICE_SELECT = `
  id, invoice_number, status, lead_id, vehicle_id,
  billing_name, billing_email, billing_phone, billing_address, billing_abn,
  gst_enabled, gst_rate, prices_include_gst,
  subtotal_cents, line_discounts_cents, invoice_discount_cents,
  net_ex_gst_cents, gst_cents, total_inc_gst_cents, payments_cents,
  due_date, issued_at, paid_at, voided_at,
  notes, payment_terms, footer_note,
  created_at, updated_at
`;

function mapInvoice(r: any): Invoice {
  return {
    id: r.id,
    invoiceNumber: r.invoice_number ?? null,
    status: r.status as InvoiceStatus,
    leadId: r.lead_id ?? null,
    vehicleId: r.vehicle_id ?? null,
    billingName: r.billing_name,
    billingEmail: r.billing_email ?? null,
    billingPhone: r.billing_phone ?? null,
    billingAddress: r.billing_address ?? null,
    billingAbn: r.billing_abn ?? null,
    gstEnabled: r.gst_enabled,
    gstRate: Number(r.gst_rate),
    pricesIncludeGst: r.prices_include_gst,
    subtotalCents: Number(r.subtotal_cents),
    lineDiscountsCents: Number(r.line_discounts_cents),
    invoiceDiscountCents: Number(r.invoice_discount_cents),
    netExGstCents: Number(r.net_ex_gst_cents),
    gstCents: Number(r.gst_cents),
    totalIncGstCents: Number(r.total_inc_gst_cents),
    paymentsCents: Number(r.payments_cents),
    dueDate: r.due_date ?? null,
    issuedAt: r.issued_at ?? null,
    paidAt: r.paid_at ?? null,
    voidedAt: r.voided_at ?? null,
    notes: r.notes ?? null,
    paymentTerms: r.payment_terms ?? null,
    footerNote: r.footer_note ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getInvoiceList(filters?: { status?: InvoiceStatus; q?: string }): Promise<InvoiceListRow[]> {
  const supabase = createAdminClient();
  
  // NOTE: In a real DB we would join with leads and vehicles. 
  // We mock the joins here for the stubbed DB context.
  let q = supabase
    .from("invoices")
    .select(`
      ${INVOICE_SELECT},
      leads ( name ),
      vehicles ( year, makes ( name ), models ( name ), variant )
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  if (filters?.status) q = q.eq("status", filters.status);
  if (filters?.q) {
    q = q.or(`invoice_number.ilike.%${filters.q}%,billing_name.ilike.%${filters.q}%`);
  }

  const { data, error } = await q;
  
  if (error || !data) return [];
  
  const todayStr = new Date().toISOString().split("T")[0];

  return data.map((r: any) => {
    const inv = mapInvoice(r);
    
    // Check overdue
    let isOverdue = false;
    if (inv.status === "issued" || inv.status === "partially_paid") {
      if (inv.dueDate && inv.dueDate < todayStr) {
        if (inv.totalIncGstCents > inv.paymentsCents) {
          isOverdue = true;
        }
      }
    }
    
    let vehicleTitle = null;
    if (r.vehicles) {
      const v = r.vehicles;
      vehicleTitle = `${v.year} ${v.makes?.name ?? ""} ${v.models?.name ?? ""}${v.variant ? ` ${v.variant}` : ""}`.trim();
    }

    return {
      ...inv,
      leadName: r.leads?.name ?? null,
      vehicleTitle,
      isOverdue,
    };
  });
}

export type InvoiceVehicleDetail = {
  id: string;
  stockId: string;
  year: number;
  makeName: string;
  modelName: string;
  variant: string | null;
  vin: string | null;
  registration: string | null;
  regoExpiry: string | null;
  mileageKm: number | null;
};

export async function getInvoiceDetail(id: string): Promise<{
  invoice: Invoice;
  items: InvoiceItem[];
  payments: InvoicePayment[];
  events: InvoiceEvent[];
  vehicle?: InvoiceVehicleDetail | null;
} | null> {
  const supabase = createAdminClient();
  
  const { data: invoiceData } = await supabase.from("invoices").select(INVOICE_SELECT).eq("id", id).maybeSingle();
  if (!invoiceData) return null;
  
  const { data: itemsData } = await supabase
    .from("invoice_items")
    .select("id, invoice_id, description, quantity, unit_price_cents, discount_cents, sort_order, created_at, updated_at")
    .eq("invoice_id", id)
    .order("sort_order", { ascending: true });
    
  const { data: paymentsData } = await supabase
    .from("invoice_payments")
    .select("id, invoice_id, amount_cents, payment_date, payment_method, reference_number, notes, recorded_by, created_at")
    .eq("invoice_id", id)
    .order("payment_date", { ascending: false });
    
  const { data: eventsData } = await supabase
    .from("invoice_events")
    .select("id, invoice_id, actor_id, event, data, created_at")
    .eq("invoice_id", id)
    .order("created_at", { ascending: true });

  const invoice = mapInvoice(invoiceData);

  let vehicle: InvoiceVehicleDetail | null = null;
  if (invoice.vehicleId) {
    const { data: vData } = await supabase
      .from("vehicles")
      .select("id, stock_id, year, vin_masked, registration, rego_expiry, mileage_km, makes ( name ), models ( name ), variant")
      .eq("id", invoice.vehicleId)
      .maybeSingle();

    if (vData) {
      const v: any = vData;
      vehicle = {
        id: v.id,
        stockId: v.stock_id,
        year: v.year,
        makeName: v.makes?.name ?? "",
        modelName: v.models?.name ?? "",
        variant: v.variant ?? null,
        vin: v.vin_masked ?? null,
        registration: v.registration ?? null,
        regoExpiry: v.rego_expiry ?? null,
        mileageKm: v.mileage_km ?? null,
      };
    }
  }
  
  const items: InvoiceItem[] = (itemsData ?? []).map((r: any) => ({
    id: r.id,
    invoiceId: r.invoice_id,
    description: r.description,
    quantity: r.quantity,
    unitPriceCents: Number(r.unit_price_cents),
    discountCents: Number(r.discount_cents),
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
  
  const payments: InvoicePayment[] = (paymentsData ?? []).map((r: any) => ({
    id: r.id,
    invoiceId: r.invoice_id,
    amountCents: Number(r.amount_cents),
    paymentDate: r.payment_date,
    paymentMethod: r.payment_method,
    referenceNumber: r.reference_number ?? null,
    notes: r.notes ?? null,
    recordedById: r.recorded_by ?? null,
    createdAt: r.created_at,
  }));
  
  const events: InvoiceEvent[] = (eventsData ?? []).map((r: any) => ({
    id: r.id,
    invoiceId: r.invoice_id,
    actorId: r.actor_id ?? null,
    event: r.event as InvoiceEvent["event"],
    data: r.data ?? {},
    createdAt: r.created_at,
  }));

  return { invoice, items, payments, events, vehicle };
}

export async function _getInvoicesKPIs(): Promise<InvoicesKPIs> {
  const supabase = createAdminClient();
  // Using an RPC in a real environment, but here we can mock or do a simple query
  const { data } = await supabase
    .from("invoices")
    .select("status, total_inc_gst_cents, payments_cents, due_date")
    .in("status", ["issued", "partially_paid", "paid"]);
    
  let totalInvoicedCents = 0;
  let totalPaidCents = 0;
  let overdueCount = 0;
  
  const todayStr = new Date().toISOString().split("T")[0];

  for (const r of (data ?? [])) {
    const total = Number(r.total_inc_gst_cents);
    const paid = Number(r.payments_cents);
    
    totalInvoicedCents += total;
    totalPaidCents += paid;
    
    if (r.status !== "paid" && r.due_date && r.due_date < todayStr && total > paid) {
      overdueCount++;
    }
  }

  return {
    totalInvoicedCents,
    totalPaidCents,
    totalOutstandingCents: Math.max(0, totalInvoicedCents - totalPaidCents),
    overdueCount,
  };
}

export const getInvoicesKPIs = async (): Promise<InvoicesKPIs> => {
  return unstable_cache(
    async () => _getInvoicesKPIs(),
    ["admin-invoices-kpis"],
    { revalidate: 60, tags: ["invoices"] },
  )();
};
