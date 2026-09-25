// @vitest-environment node
import { describe, expect, it } from "vitest";
import { businessDefaults, type BusinessProfile } from "@/config/business";
import type { Invoice, InvoiceItem } from "@/lib/domain";
import { renderInvoicePdf } from "./pdf";

const profile: BusinessProfile = { ...businessDefaults, legalName: "Test Motors Pty Ltd", abn: "51824753556" };

const invoice: Invoice = {
  id: "i1",
  invoiceNumber: "AH-2026-000042",
  status: "issued",
  leadId: null,
  vehicleId: null,
  billingName: "Jane Buyer",
  billingEmail: "jane@example.com",
  billingPhone: null,
  billingAddress: "1 Test St, Sydney NSW 2000",
  billingAbn: null,
  gstEnabled: true,
  gstRate: 10,
  pricesIncludeGst: true,
  documentTitle: "Tax Invoice",
  sellerSnapshot: {
    legalName: "Test Motors Pty Ltd",
    tradingName: "Test Motors",
    abn: "51824753556",
    email: "sales@example.com",
    phone: "02 9876 5432",
    address: "2 Yard Rd, Sydney NSW 2000",
    bank: { accountName: "Test Motors", bsb: "000-000", accountNumber: "12345678", payId: "" },
  },
  vehicleSnapshot: { stockId: "A1", year: 2019, make: "Toyota", model: "Corolla", variant: "Ascent", vin: "JTDBR32E720000000", registration: "ABC123", regoExpiry: "2027-01-31", odometerKm: 81234 },
  subtotalCents: 0,
  lineDiscountsCents: 0,
  invoiceDiscountCents: 0,
  netExGstCents: 0,
  gstCents: 0,
  gstFreeCents: 0,
  totalIncGstCents: 0,
  paymentsCents: 0,
  dueDate: "2026-10-09",
  issuedAt: "2026-09-25T00:00:00.000Z",
  paidAt: null,
  voidedAt: null,
  notes: null,
  paymentTerms: "7 days",
  footerNote: null,
  createdAt: "2026-09-25T00:00:00.000Z",
  updatedAt: "2026-09-25T00:00:00.000Z",
};

const items = (n: number): InvoiceItem[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `l${i}`,
    invoiceId: "i1",
    description: i === 0 ? "2019 Toyota Corolla Ascent" : `Accessory ${i} with a longer description that wraps onto a second line in the table`,
    quantity: 1,
    unitPriceCents: i === 0 ? 2_199_000 : 12_500,
    discountCents: 0,
    gstApplicable: i % 5 !== 4,
    sortOrder: i,
    createdAt: "",
    updatedAt: "",
  }));

const pageCount = (pdf: Buffer) => (pdf.toString("latin1").match(/\/Type\s*\/Page(?!s)/g) ?? []).length;

describe("renderInvoicePdf", () => {
  it("renders a valid one-page PDF for a short tax invoice", async () => {
    const pdf = await renderInvoicePdf({ invoice, items: items(2), vehicle: null }, profile);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pageCount(pdf)).toBe(1);
  }, 30_000);

  it("paginates a long invoice instead of clipping it", async () => {
    const pdf = await renderInvoicePdf({ invoice, items: items(60), vehicle: null }, profile);
    expect(pageCount(pdf)).toBeGreaterThan(1);
  }, 30_000);

  it("renders a draft from live settings", async () => {
    const draft = { ...invoice, status: "draft" as const, invoiceNumber: null, documentTitle: null, sellerSnapshot: null, vehicleSnapshot: null };
    const pdf = await renderInvoicePdf({ invoice: draft, items: items(1), vehicle: null }, profile);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  }, 30_000);
});
