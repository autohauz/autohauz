import "server-only";
import { unstable_cache } from "next/cache";
import { requirePermission } from "@/lib/security/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeSearchTerm } from "@/lib/data/search";
import { isInvoiceOverdue } from "@/lib/invoices/document";
import type {
  Invoice,
  InvoiceEvent,
  InvoiceItem,
  InvoicePayment,
  InvoiceSellerSnapshot,
  InvoiceStatus,
  InvoiceVehicleSnapshot,
} from "@/lib/domain";

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

/** Row shape of `invoices` (migrations 0022 + 20260924100100). */
type InvoiceRow = {
  id: string;
  invoice_number: string | null;
  status: InvoiceStatus;
  lead_id: string | null;
  vehicle_id: string | null;
  billing_name: string;
  billing_email: string | null;
  billing_phone: string | null;
  billing_address: string | null;
  billing_abn: string | null;
  gst_enabled: boolean;
  gst_rate: number | string;
  prices_include_gst: boolean;
  document_title: string | null;
  seller_snapshot: InvoiceSellerSnapshot | null;
  vehicle_snapshot: InvoiceVehicleSnapshot | null;
  subtotal_cents: number | string;
  line_discounts_cents: number | string;
  invoice_discount_cents: number | string;
  net_ex_gst_cents: number | string;
  gst_cents: number | string;
  gst_free_cents: number | string | null;
  total_inc_gst_cents: number | string;
  payments_cents: number | string;
  due_date: string | null;
  issued_at: string | null;
  paid_at: string | null;
  voided_at: string | null;
  notes: string | null;
  payment_terms: string | null;
  footer_note: string | null;
  created_at: string;
  updated_at: string;
};

const INVOICE_SELECT = `
  id, invoice_number, status, lead_id, vehicle_id,
  billing_name, billing_email, billing_phone, billing_address, billing_abn,
  gst_enabled, gst_rate, prices_include_gst,
  document_title, seller_snapshot, vehicle_snapshot,
  subtotal_cents, line_discounts_cents, invoice_discount_cents,
  net_ex_gst_cents, gst_cents, gst_free_cents, total_inc_gst_cents, payments_cents,
  due_date, issued_at, paid_at, voided_at,
  notes, payment_terms, footer_note,
  created_at, updated_at
`;

function mapInvoice(r: InvoiceRow): Invoice {
  return {
    id: r.id,
    invoiceNumber: r.invoice_number,
    status: r.status,
    leadId: r.lead_id,
    vehicleId: r.vehicle_id,
    billingName: r.billing_name,
    billingEmail: r.billing_email,
    billingPhone: r.billing_phone,
    billingAddress: r.billing_address,
    billingAbn: r.billing_abn,
    gstEnabled: r.gst_enabled,
    gstRate: Number(r.gst_rate),
    pricesIncludeGst: r.prices_include_gst,
    documentTitle: r.document_title,
    sellerSnapshot: r.seller_snapshot,
    vehicleSnapshot: r.vehicle_snapshot,
    subtotalCents: Number(r.subtotal_cents),
    lineDiscountsCents: Number(r.line_discounts_cents),
    invoiceDiscountCents: Number(r.invoice_discount_cents),
    netExGstCents: Number(r.net_ex_gst_cents),
    gstCents: Number(r.gst_cents),
    gstFreeCents: Number(r.gst_free_cents ?? 0),
    totalIncGstCents: Number(r.total_inc_gst_cents),
    paymentsCents: Number(r.payments_cents),
    dueDate: r.due_date,
    issuedAt: r.issued_at,
    paidAt: r.paid_at,
    voidedAt: r.voided_at,
    notes: r.notes,
    paymentTerms: r.payment_terms,
    footerNote: r.footer_note,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

type VehicleRow = {
  id: string;
  stock_id: string | null;
  year: number | null;
  variant: string | null;
  vin: string | null;
  registration: string | null;
  rego_expiry: string | null;
  mileage_km: number | null;
  makes: { name: string } | null;
  models: { name: string } | null;
};

const VEHICLE_SELECT = "id, stock_id, year, variant, vin, registration, rego_expiry, mileage_km, makes ( name ), models ( name )";

function toVehicleSnapshot(v: VehicleRow): InvoiceVehicleSnapshot {
  return {
    stockId: v.stock_id,
    year: v.year,
    make: v.makes?.name ?? "",
    model: v.models?.name ?? "",
    variant: v.variant,
    vin: v.vin,
    registration: v.registration,
    regoExpiry: v.rego_expiry,
    odometerKm: v.mileage_km,
  };
}

/**
 * Current particulars of a vehicle, in the shape frozen onto an invoice at
 * issue. Service-role read; callers are invoice actions that already checked
 * permission.
 */
export async function getVehicleSnapshot(vehicleId: string): Promise<InvoiceVehicleSnapshot | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("vehicles").select(VEHICLE_SELECT).eq("id", vehicleId).maybeSingle();
  if (error) console.error("[invoices] vehicle lookup failed:", error.message);
  return data ? toVehicleSnapshot(data as unknown as VehicleRow) : null;
}

/** Vehicles an invoice can be raised against (not archived), newest first. */
export async function getInvoiceableVehicles(): Promise<{ id: string; label: string }[]> {
  await requirePermission("invoices.write");
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("vehicles")
    .select("id, stock_id, year, variant, status, makes ( name ), models ( name )")
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) console.error("[invoices] vehicle list failed:", error.message);
  type Row = { id: string; stock_id: string | null; year: number | null; variant: string | null; status: string; makes: { name: string } | null; models: { name: string } | null };
  return ((data ?? []) as unknown as Row[]).map((v) => ({
    id: v.id,
    label: `${v.stock_id ?? "—"} · ${[v.year, v.makes?.name, v.models?.name, v.variant].filter(Boolean).join(" ")} (${v.status})`,
  }));
}

export async function getInvoiceList(filters?: { status?: InvoiceStatus; q?: string }): Promise<InvoiceListRow[]> {
  await requirePermission("invoices.view");
  const supabase = createAdminClient();

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
  const term = sanitizeSearchTerm(filters?.q);
  if (term) q = q.or(`invoice_number.ilike.%${term}%,billing_name.ilike.%${term}%`);

  const { data, error } = await q;
  if (error) {
    console.error("[invoices] list query failed:", error.message);
    return [];
  }

  type ListRow = InvoiceRow & {
    leads: { name: string } | null;
    vehicles: { year: number; variant: string | null; makes: { name: string } | null; models: { name: string } | null } | null;
  };

  return ((data ?? []) as unknown as ListRow[]).map((r) => {
    const inv = mapInvoice(r);
    const v = r.vehicles;
    return {
      ...inv,
      leadName: r.leads?.name ?? null,
      vehicleTitle: v ? [v.year, v.makes?.name, v.models?.name, v.variant].filter(Boolean).join(" ") : null,
      isOverdue: isInvoiceOverdue(inv),
    };
  });
}

export async function getInvoiceDetail(id: string): Promise<{
  invoice: Invoice;
  items: InvoiceItem[];
  payments: InvoicePayment[];
  events: InvoiceEvent[];
  /** Live vehicle particulars (drafts); issued invoices use invoice.vehicleSnapshot. */
  vehicle: InvoiceVehicleSnapshot | null;
} | null> {
  await requirePermission("invoices.view");
  const supabase = createAdminClient();

  const { data: invoiceData, error } = await supabase.from("invoices").select(INVOICE_SELECT).eq("id", id).maybeSingle();
  if (error) console.error("[invoices] detail query failed:", error.message);
  if (!invoiceData) return null;
  const invoice = mapInvoice(invoiceData as unknown as InvoiceRow);

  const [itemsRes, paymentsRes, eventsRes, vehicle] = await Promise.all([
    supabase
      .from("invoice_items")
      .select("id, invoice_id, description, quantity, unit_price_cents, discount_cents, gst_applicable, sort_order, created_at, updated_at")
      .eq("invoice_id", id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("invoice_payments")
      .select("id, invoice_id, amount_cents, payment_date, payment_method, reference_number, notes, recorded_by, created_at")
      .eq("invoice_id", id)
      .order("payment_date", { ascending: false }),
    supabase
      .from("invoice_events")
      .select("id, invoice_id, actor_id, event, data, created_at")
      .eq("invoice_id", id)
      .order("created_at", { ascending: true }),
    invoice.vehicleId ? getVehicleSnapshot(invoice.vehicleId) : Promise.resolve(null),
  ]);

  type ItemRow = {
    id: string; invoice_id: string; description: string; quantity: number; unit_price_cents: number | string;
    discount_cents: number | string; gst_applicable: boolean | null; sort_order: number; created_at: string; updated_at: string;
  };
  type PaymentRow = {
    id: string; invoice_id: string; amount_cents: number | string; payment_date: string; payment_method: string;
    reference_number: string | null; notes: string | null; recorded_by: string | null; created_at: string;
  };
  type EventRow = { id: string; invoice_id: string; actor_id: string | null; event: string; data: Record<string, unknown> | null; created_at: string };

  const items: InvoiceItem[] = ((itemsRes.data ?? []) as ItemRow[]).map((r) => ({
    id: r.id,
    invoiceId: r.invoice_id,
    description: r.description,
    quantity: r.quantity,
    unitPriceCents: Number(r.unit_price_cents),
    discountCents: Number(r.discount_cents),
    gstApplicable: r.gst_applicable !== false,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  const payments: InvoicePayment[] = ((paymentsRes.data ?? []) as PaymentRow[]).map((r) => ({
    id: r.id,
    invoiceId: r.invoice_id,
    amountCents: Number(r.amount_cents),
    paymentDate: r.payment_date,
    paymentMethod: r.payment_method,
    referenceNumber: r.reference_number,
    notes: r.notes,
    recordedById: r.recorded_by,
    createdAt: r.created_at,
  }));

  const events: InvoiceEvent[] = ((eventsRes.data ?? []) as EventRow[]).map((r) => ({
    id: r.id,
    invoiceId: r.invoice_id,
    actorId: r.actor_id,
    event: r.event as InvoiceEvent["event"],
    data: r.data ?? {},
    createdAt: r.created_at,
  }));

  return { invoice, items, payments, events, vehicle };
}

async function loadInvoicesKPIs(): Promise<InvoicesKPIs> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("status, total_inc_gst_cents, payments_cents, due_date")
    .in("status", ["issued", "partially_paid", "paid"]);
  if (error) console.error("[invoices] KPI query failed:", error.message);

  let totalInvoicedCents = 0;
  let totalPaidCents = 0;
  let overdueCount = 0;

  type KpiRow = { status: InvoiceStatus; total_inc_gst_cents: number | string; payments_cents: number | string; due_date: string | null };
  for (const r of (data ?? []) as KpiRow[]) {
    const totalIncGstCents = Number(r.total_inc_gst_cents);
    const paymentsCents = Number(r.payments_cents);
    totalInvoicedCents += totalIncGstCents;
    totalPaidCents += paymentsCents;
    if (isInvoiceOverdue({ status: r.status, dueDate: r.due_date, totalIncGstCents, paymentsCents })) overdueCount++;
  }

  return {
    totalInvoicedCents,
    totalPaidCents,
    totalOutstandingCents: Math.max(0, totalInvoicedCents - totalPaidCents),
    overdueCount,
  };
}

export async function getInvoicesKPIs(): Promise<InvoicesKPIs> {
  await requirePermission("invoices.view");
  return unstable_cache(loadInvoicesKPIs, ["admin-invoices-kpis"], { revalidate: 60, tags: ["invoices"] })();
}
