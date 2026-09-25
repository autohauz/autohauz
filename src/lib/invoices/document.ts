import type {
  Invoice,
  InvoiceItem,
  InvoiceSellerSnapshot,
  InvoiceVehicleSnapshot,
} from "@/lib/domain";
import type { BusinessProfile } from "@/config/business";
import { formatAddress } from "@/config/business";
import { formatABN, isValidABN } from "@/lib/validation/abn";

/**
 * One view of an invoice for every renderer (admin preview, print, PDF,
 * email). Issued invoices render ONLY from their frozen snapshots; drafts
 * render from live settings, clearly marked as a draft.
 */
export type InvoiceView = {
  title: string;
  number: string;
  isDraft: boolean;
  isOverdue: boolean;
  seller: InvoiceSellerSnapshot;
  vehicle: InvoiceVehicleSnapshot | null;
  lines: {
    id: string;
    description: string;
    quantity: number;
    unitPriceCents: number;
    discountCents: number;
    amountCents: number;
    gstFree: boolean;
  }[];
  /** Explains how GST applies; shown under the totals. */
  gstNote: string | null;
  hasGstFreeLines: boolean;
  subtotalLabel: string;
  balanceDueCents: number;
};

export function sellerSnapshotFrom(profile: BusinessProfile): InvoiceSellerSnapshot {
  return {
    legalName: profile.legalName,
    tradingName: profile.tradingName,
    abn: profile.abn,
    email: profile.email,
    phone: profile.phone,
    address: formatAddress(profile.address),
    bank: { ...profile.invoice.bank },
  };
}

/**
 * The document title and whether the invoice may be issued as a tax invoice.
 * A tax invoice must identify the seller by name and ABN, so charging GST
 * without a valid ABN on file is refused rather than printed incorrectly.
 * (This is a completeness check, not tax advice.)
 */
export function taxInvoiceReadiness(
  gstEnabled: boolean,
  seller: Pick<InvoiceSellerSnapshot, "legalName" | "abn">,
): { ok: true; title: "Tax Invoice" | "Invoice" } | { ok: false; reason: string } {
  if (!gstEnabled) return { ok: true, title: "Invoice" };
  if (!seller.legalName.trim()) {
    return { ok: false, reason: "Add the business legal name in Settings before issuing a tax invoice." };
  }
  if (!isValidABN(seller.abn)) {
    return { ok: false, reason: "Add a valid ABN in Settings before issuing a tax invoice." };
  }
  return { ok: true, title: "Tax Invoice" };
}

/** Today's date in Sydney as YYYY-MM-DD (due dates are Australian calendar dates). */
export function sydneyToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isInvoiceOverdue(
  invoice: Pick<Invoice, "status" | "dueDate" | "totalIncGstCents" | "paymentsCents">,
  now = new Date(),
): boolean {
  if (invoice.status !== "issued" && invoice.status !== "partially_paid") return false;
  if (!invoice.dueDate) return false;
  if (invoice.totalIncGstCents - invoice.paymentsCents <= 0) return false;
  return invoice.dueDate < sydneyToday(now);
}

export function buildInvoiceView(input: {
  invoice: Invoice;
  items: InvoiceItem[];
  /** Live vehicle, used only while the invoice is a draft. */
  liveVehicle: InvoiceVehicleSnapshot | null;
  /** Live business profile, used only while the invoice is a draft. */
  liveProfile: BusinessProfile;
  now?: Date;
}): InvoiceView {
  const { invoice, items, liveVehicle, liveProfile, now } = input;
  const isDraft = invoice.status === "draft";

  // Issued invoices never read live settings: a later ABN/bank/address change
  // must not rewrite a document the customer already holds. Legacy invoices
  // issued before snapshots existed fall back to live data.
  const seller = (!isDraft && invoice.sellerSnapshot) || sellerSnapshotFrom(liveProfile);
  const vehicle = !isDraft && invoice.sellerSnapshot ? invoice.vehicleSnapshot : liveVehicle;

  const title = invoice.documentTitle ?? (invoice.gstEnabled ? "Tax Invoice" : "Invoice");
  const hasGstFreeLines = invoice.gstEnabled && items.some((i) => !i.gstApplicable);

  let gstNote: string | null = null;
  if (invoice.gstEnabled) {
    gstNote = invoice.pricesIncludeGst ? "Prices include GST" : "Prices exclude GST";
    if (hasGstFreeLines) gstNote += "; items marked * are GST-free";
    gstNote += ".";
  }

  return {
    title,
    number: invoice.invoiceNumber ?? "DRAFT",
    isDraft,
    isOverdue: isInvoiceOverdue(invoice, now),
    seller: { ...seller, abn: seller.abn && isValidABN(seller.abn) ? formatABN(seller.abn) : seller.abn },
    vehicle,
    lines: items.map((i) => ({
      id: i.id,
      description: i.description,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
      discountCents: i.discountCents,
      amountCents: i.unitPriceCents * i.quantity - i.discountCents,
      gstFree: invoice.gstEnabled && !i.gstApplicable,
    })),
    gstNote,
    hasGstFreeLines,
    subtotalLabel: invoice.gstEnabled && invoice.pricesIncludeGst ? "Subtotal (inc. GST)" : "Subtotal",
    balanceDueCents: Math.max(0, invoice.totalIncGstCents - invoice.paymentsCents),
  };
}

export function formatAud(cents: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(cents / 100);
}

export function formatAuDate(iso: string | null): string {
  if (!iso) return "—";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00+10:00`) : new Date(iso);
  return new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", day: "numeric", month: "short", year: "numeric" }).format(d);
}

export function vehicleTitle(v: InvoiceVehicleSnapshot): string {
  return [v.year, v.make, v.model, v.variant].filter(Boolean).join(" ");
}
