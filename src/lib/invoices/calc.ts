export type InvoiceLineInput = {
  unitPriceCents: number;
  quantity: number;
  discountCents?: number;
  /**
   * Whether GST applies to this line. Defaults to true. Set false for
   * GST-free items (e.g. registration, CTP, stamp duty passed through at cost).
   * Which items are GST-free is the business's call, not the software's.
   */
  gstApplicable?: boolean;
};

export type CalculateInvoiceParams = {
  lines: InvoiceLineInput[];
  invoiceDiscountCents?: number;
  paymentsCents?: number;
  settings: {
    gstEnabled: boolean;
    gstRate: number; // e.g. 10 for 10%
    pricesIncludeGst: boolean;
  };
};

export type InvoiceTotals = {
  subtotalCents: number;      // Sum of (unitPrice * quantity)
  lineDiscountsCents: number; // Sum of line discounts
  invoiceDiscountCents: number;
  totalDiscountCents: number; // lineDiscountsCents + invoiceDiscountCents
  netExGstCents: number;      // Total amount excluding GST
  gstCents: number;           // GST amount
  gstFreeCents: number;       // Portion of the total on which no GST is charged
  totalIncGstCents: number;   // Total amount including GST (amount due before payments)
  paymentsCents: number;      // Amount already paid
  balanceDueCents: number;    // totalIncGstCents - paymentsCents
};

/**
 * Invoice totals in integer cents.
 *
 * GST is calculated on the taxable portion only. An invoice-level discount is
 * spread across taxable and GST-free lines in proportion to their value, so it
 * reduces GST only by the share that falls on taxable supplies. With every
 * line taxable (the default) this is exactly the single-rate calculation.
 */
export function calculateInvoiceTotals(params: CalculateInvoiceParams): InvoiceTotals {
  const { lines, settings, invoiceDiscountCents = 0, paymentsCents = 0 } = params;

  let subtotalCents = 0;
  let lineDiscountsCents = 0;
  let taxableCents = 0;
  let freeCents = 0;

  for (const line of lines) {
    const gross = line.unitPriceCents * line.quantity;
    const disc = line.discountCents ?? 0;
    subtotalCents += gross;
    lineDiscountsCents += disc;
    const net = Math.max(0, gross - disc);
    if (settings.gstEnabled && line.gstApplicable !== false) taxableCents += net;
    else freeCents += net;
  }

  const totalDiscountCents = lineDiscountsCents + invoiceDiscountCents;

  // Allocate the invoice discount proportionally (taxable share rounded, the
  // GST-free share takes the remainder so the two always sum exactly).
  const base = taxableCents + freeCents;
  const discount = Math.min(invoiceDiscountCents, base);
  const taxableShare = base > 0 ? Math.round((discount * taxableCents) / base) : 0;
  const taxableAfter = Math.max(0, taxableCents - taxableShare);
  const freeAfter = Math.max(0, freeCents - (discount - taxableShare));

  let gstCents = 0;
  let netExGstCents: number;
  let totalIncGstCents: number;

  if (settings.gstEnabled && taxableAfter > 0) {
    const rate = settings.gstRate / 100;
    if (settings.pricesIncludeGst) {
      // Taxable amounts already include GST: GST = total − total / (1 + rate).
      gstCents = Math.round(taxableAfter - taxableAfter / (1 + rate));
      totalIncGstCents = taxableAfter + freeAfter;
      netExGstCents = totalIncGstCents - gstCents;
    } else {
      gstCents = Math.round(taxableAfter * rate);
      netExGstCents = taxableAfter + freeAfter;
      totalIncGstCents = netExGstCents + gstCents;
    }
  } else {
    netExGstCents = taxableAfter + freeAfter;
    totalIncGstCents = netExGstCents;
  }

  return {
    subtotalCents,
    lineDiscountsCents,
    invoiceDiscountCents,
    totalDiscountCents,
    netExGstCents,
    gstCents,
    gstFreeCents: freeAfter,
    totalIncGstCents,
    paymentsCents,
    balanceDueCents: Math.max(0, totalIncGstCents - paymentsCents),
  };
}
