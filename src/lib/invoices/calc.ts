export type InvoiceLineInput = {
  unitPriceCents: number;
  quantity: number;
  discountCents?: number;
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
  totalIncGstCents: number;   // Total amount including GST (amount due before payments)
  paymentsCents: number;      // Amount already paid
  balanceDueCents: number;    // totalIncGstCents - paymentsCents
};

export function calculateInvoiceTotals(params: CalculateInvoiceParams): InvoiceTotals {
  const { lines, settings, invoiceDiscountCents = 0, paymentsCents = 0 } = params;

  let subtotalCents = 0;
  let lineDiscountsCents = 0;

  for (const line of lines) {
    const qty = line.quantity;
    const price = line.unitPriceCents;
    const disc = line.discountCents ?? 0;
    
    subtotalCents += price * qty;
    lineDiscountsCents += disc;
  }

  // The base total after all discounts (before applying GST logic)
  const totalAfterDiscountsCents = Math.max(0, subtotalCents - lineDiscountsCents - invoiceDiscountCents);
  const totalDiscountCents = lineDiscountsCents + invoiceDiscountCents;

  let netExGstCents = 0;
  let gstCents = 0;
  let totalIncGstCents = 0;

  if (settings.gstEnabled) {
    const rateMultiplier = settings.gstRate / 100; // e.g., 0.10

    if (settings.pricesIncludeGst) {
      // totalAfterDiscountsCents is inclusive of GST
      totalIncGstCents = totalAfterDiscountsCents;
      // Extract GST: GST = Total - (Total / (1 + Rate))
      const exGst = totalIncGstCents / (1 + rateMultiplier);
      gstCents = Math.round(totalIncGstCents - exGst);
      netExGstCents = totalIncGstCents - gstCents;
    } else {
      // totalAfterDiscountsCents is exclusive of GST
      netExGstCents = totalAfterDiscountsCents;
      gstCents = Math.round(netExGstCents * rateMultiplier);
      totalIncGstCents = netExGstCents + gstCents;
    }
  } else {
    // No GST
    netExGstCents = totalAfterDiscountsCents;
    gstCents = 0;
    totalIncGstCents = totalAfterDiscountsCents;
  }

  const balanceDueCents = Math.max(0, totalIncGstCents - paymentsCents);

  return {
    subtotalCents,
    lineDiscountsCents,
    invoiceDiscountCents,
    totalDiscountCents,
    netExGstCents,
    gstCents,
    totalIncGstCents,
    paymentsCents,
    balanceDueCents,
  };
}
