import { describe, it, expect } from "vitest";
import { calculateInvoiceTotals } from "../../lib/invoices/calc";

describe("calculateInvoiceTotals", () => {
  it("calculates a simple single-line invoice without GST", () => {
    const result = calculateInvoiceTotals({
      lines: [{ unitPriceCents: 10000, quantity: 1 }],
      settings: { gstEnabled: false, gstRate: 10, pricesIncludeGst: false },
    });
    expect(result.subtotalCents).toBe(10000);
    expect(result.netExGstCents).toBe(10000);
    expect(result.gstCents).toBe(0);
    expect(result.totalIncGstCents).toBe(10000);
    expect(result.balanceDueCents).toBe(10000);
  });

  it("calculates GST exclusive (10%)", () => {
    const result = calculateInvoiceTotals({
      lines: [{ unitPriceCents: 10000, quantity: 2 }], // 200.00
      settings: { gstEnabled: true, gstRate: 10, pricesIncludeGst: false },
    });
    expect(result.subtotalCents).toBe(20000);
    expect(result.netExGstCents).toBe(20000);
    expect(result.gstCents).toBe(2000); // 20.00 GST
    expect(result.totalIncGstCents).toBe(22000);
    expect(result.balanceDueCents).toBe(22000);
  });

  it("calculates GST inclusive (10%)", () => {
    const result = calculateInvoiceTotals({
      lines: [{ unitPriceCents: 11000, quantity: 2 }], // 220.00
      settings: { gstEnabled: true, gstRate: 10, pricesIncludeGst: true },
    });
    expect(result.subtotalCents).toBe(22000);
    expect(result.netExGstCents).toBe(20000);
    expect(result.gstCents).toBe(2000); // 20.00 GST
    expect(result.totalIncGstCents).toBe(22000);
    expect(result.balanceDueCents).toBe(22000);
  });

  it("handles line discounts and invoice discounts", () => {
    const result = calculateInvoiceTotals({
      lines: [
        { unitPriceCents: 10000, quantity: 1, discountCents: 1000 }, // 90.00 after line discount
      ],
      invoiceDiscountCents: 2000, // another 20.00 off
      settings: { gstEnabled: true, gstRate: 10, pricesIncludeGst: false },
    });
    // subtotal = 100.00
    // total after discounts = 70.00
    // + 10% GST = 77.00
    expect(result.subtotalCents).toBe(10000);
    expect(result.lineDiscountsCents!).toBe(1000);
    expect(result.invoiceDiscountCents!).toBe(2000);
    expect(result.totalDiscountCents!).toBe(3000);
    expect(result.netExGstCents).toBe(7000);
    expect(result.gstCents).toBe(700);
    expect(result.totalIncGstCents).toBe(7700);
    expect(result.balanceDueCents).toBe(7700);
  });

  it("rounds GST correctly (half up)", () => {
    // GST exclusive: total is 10.05
    // 10% of 10.05 = 1.005 -> rounds to 1.01
    let result = calculateInvoiceTotals({
      lines: [{ unitPriceCents: 1005, quantity: 1 }],
      settings: { gstEnabled: true, gstRate: 10, pricesIncludeGst: false },
    });
    expect(result.netExGstCents).toBe(1005);
    expect(result.gstCents).toBe(101); // 1.005 rounded up
    expect(result.totalIncGstCents).toBe(1106);

    // GST inclusive: total is 11.06
    // GST = 11.06 - (11.06 / 1.1) = 11.06 - 10.0545... = 1.00545... -> rounds to 1.01
    result = calculateInvoiceTotals({
      lines: [{ unitPriceCents: 1106, quantity: 1 }],
      settings: { gstEnabled: true, gstRate: 10, pricesIncludeGst: true },
    });
    expect(result.totalIncGstCents).toBe(1106);
    expect(result.gstCents).toBe(101); 
    expect(result.netExGstCents).toBe(1005);
  });

  it("handles partial and full payments", () => {
    const result = calculateInvoiceTotals({
      lines: [{ unitPriceCents: 11000, quantity: 1 }],
      paymentsCents: 5000,
      settings: { gstEnabled: true, gstRate: 10, pricesIncludeGst: true },
    });
    expect(result.totalIncGstCents).toBe(11000);
    expect(result.paymentsCents).toBe(5000);
    expect(result.balanceDueCents).toBe(6000);
  });

  it("guards against negative balance due", () => {
    const result = calculateInvoiceTotals({
      lines: [{ unitPriceCents: 10000, quantity: 1 }],
      paymentsCents: 15000, // Overpayment
      settings: { gstEnabled: true, gstRate: 10, pricesIncludeGst: true },
    });
    expect(result.totalIncGstCents).toBe(10000);
    expect(result.balanceDueCents).toBe(0); // Should not be negative
  });

  it("guards against total going negative due to excessive discounts", () => {
    const result = calculateInvoiceTotals({
      lines: [{ unitPriceCents: 10000, quantity: 1 }],
      invoiceDiscountCents: 15000,
      settings: { gstEnabled: true, gstRate: 10, pricesIncludeGst: true },
    });
    // removed undefined property
    expect(result.totalIncGstCents).toBe(0);
    expect(result.netExGstCents).toBe(0);
    expect(result.gstCents).toBe(0);
    expect(result.balanceDueCents).toBe(0);
  });

  describe("per-line GST", () => {
    const settings = { gstEnabled: true, gstRate: 10, pricesIncludeGst: true };

    it("charges no GST on GST-free lines (car inc. GST + rego at cost)", () => {
      const r = calculateInvoiceTotals({
        lines: [
          { unitPriceCents: 2200000, quantity: 1 }, // $22,000 car, GST inclusive
          { unitPriceCents: 85000, quantity: 1, gstApplicable: false }, // $850 rego
        ],
        settings,
      });
      expect(r.gstCents).toBe(200000);
      expect(r.gstFreeCents).toBe(85000);
      expect(r.totalIncGstCents).toBe(2285000);
      expect(r.netExGstCents).toBe(2085000);
    });

    it("spreads an invoice discount proportionally and keeps totals exact", () => {
      const r = calculateInvoiceTotals({
        lines: [
          { unitPriceCents: 30000, quantity: 1 },
          { unitPriceCents: 10000, quantity: 1, gstApplicable: false },
        ],
        invoiceDiscountCents: 4000, // 3,000 on taxable, 1,000 on GST-free
        settings,
      });
      expect(r.gstFreeCents).toBe(9000);
      expect(r.gstCents).toBe(Math.round(27000 - 27000 / 1.1));
      expect(r.totalIncGstCents).toBe(36000);
      expect(r.netExGstCents + r.gstCents).toBe(r.totalIncGstCents);
    });

    it("treats every line as GST-free when GST is disabled", () => {
      const r = calculateInvoiceTotals({
        lines: [{ unitPriceCents: 10000, quantity: 1 }],
        settings: { ...settings, gstEnabled: false },
      });
      expect(r.gstCents).toBe(0);
      expect(r.gstFreeCents).toBe(10000);
    });

    it("never produces a negative total when discounts exceed the value", () => {
      const r = calculateInvoiceTotals({
        lines: [{ unitPriceCents: 1000, quantity: 1 }],
        invoiceDiscountCents: 5000,
        settings,
      });
      expect(r.totalIncGstCents).toBe(0);
      expect(r.gstCents).toBe(0);
    });
  });
});
