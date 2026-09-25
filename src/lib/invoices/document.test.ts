import { describe, expect, it } from "vitest";
import { businessDefaults, type BusinessProfile } from "@/config/business";
import type { Invoice, InvoiceItem } from "@/lib/domain";
import { buildInvoiceView, isInvoiceOverdue, sydneyToday, taxInvoiceReadiness } from "./document";

const profile: BusinessProfile = {
  ...businessDefaults,
  legalName: "Live Pty Ltd",
  abn: "51824753556",
  invoice: { ...businessDefaults.invoice, bank: { accountName: "LIVE", bsb: "000-000", accountNumber: "1", payId: "" } },
};

const invoice = (o: Partial<Invoice> = {}): Invoice => ({
  id: "i1",
  invoiceNumber: null,
  status: "draft",
  leadId: null,
  vehicleId: null,
  billingName: "Jane",
  billingEmail: null,
  billingPhone: null,
  billingAddress: null,
  billingAbn: null,
  gstEnabled: true,
  gstRate: 10,
  pricesIncludeGst: true,
  documentTitle: null,
  sellerSnapshot: null,
  vehicleSnapshot: null,
  subtotalCents: 1000,
  lineDiscountsCents: 0,
  invoiceDiscountCents: 0,
  netExGstCents: 909,
  gstCents: 91,
  gstFreeCents: 0,
  totalIncGstCents: 1000,
  paymentsCents: 0,
  dueDate: null,
  issuedAt: null,
  paidAt: null,
  voidedAt: null,
  notes: null,
  paymentTerms: null,
  footerNote: null,
  createdAt: "",
  updatedAt: "",
  ...o,
});

const item = (o: Partial<InvoiceItem> = {}): InvoiceItem => ({
  id: "l1",
  invoiceId: "i1",
  description: "Car",
  quantity: 1,
  unitPriceCents: 1000,
  discountCents: 0,
  gstApplicable: true,
  sortOrder: 0,
  createdAt: "",
  updatedAt: "",
  ...o,
});

describe("buildInvoiceView", () => {
  it("renders an issued invoice from its snapshot, never live settings", () => {
    const snap = { ...profile, legalName: "Frozen Pty Ltd" };
    const view = buildInvoiceView({
      invoice: invoice({
        status: "issued",
        invoiceNumber: "AH-2026-000001",
        documentTitle: "Tax Invoice",
        sellerSnapshot: {
          legalName: snap.legalName,
          tradingName: "",
          abn: "51824753556",
          email: "",
          phone: "",
          address: "",
          bank: { accountName: "FROZEN", bsb: "", accountNumber: "", payId: "" },
        },
        vehicleSnapshot: { stockId: "A1", year: 2019, make: "Toyota", model: "Corolla", variant: null, vin: "V", registration: null, regoExpiry: null, odometerKm: 1 },
      }),
      items: [item()],
      liveVehicle: null,
      liveProfile: profile,
    });
    expect(view.seller.legalName).toBe("Frozen Pty Ltd");
    expect(view.seller.bank.accountName).toBe("FROZEN");
    expect(view.seller.abn).toBe("51 824 753 556");
    expect(view.vehicle?.stockId).toBe("A1");
    expect(view.title).toBe("Tax Invoice");
    expect(view.isDraft).toBe(false);
  });

  it("renders a draft from live settings", () => {
    const view = buildInvoiceView({ invoice: invoice(), items: [item()], liveVehicle: null, liveProfile: profile });
    expect(view.seller.legalName).toBe("Live Pty Ltd");
    expect(view.number).toBe("DRAFT");
    expect(view.isDraft).toBe(true);
  });

  it("marks GST-free lines and labels an inclusive subtotal honestly", () => {
    const view = buildInvoiceView({
      invoice: invoice(),
      items: [item(), item({ id: "l2", description: "Rego", gstApplicable: false })],
      liveVehicle: null,
      liveProfile: profile,
    });
    expect(view.lines.map((l) => l.gstFree)).toEqual([false, true]);
    expect(view.gstNote).toBe("Prices include GST; items marked * are GST-free.");
    expect(view.subtotalLabel).toBe("Subtotal (inc. GST)");
  });
});

describe("taxInvoiceReadiness", () => {
  it("requires a legal name and valid ABN only when charging GST", () => {
    expect(taxInvoiceReadiness(false, { legalName: "", abn: "" })).toEqual({ ok: true, title: "Invoice" });
    expect(taxInvoiceReadiness(true, { legalName: "X", abn: "123" }).ok).toBe(false);
    expect(taxInvoiceReadiness(true, { legalName: " ", abn: "51824753556" }).ok).toBe(false);
    expect(taxInvoiceReadiness(true, { legalName: "X", abn: "51 824 753 556" })).toEqual({ ok: true, title: "Tax Invoice" });
  });
});

describe("overdue", () => {
  it("uses the Sydney calendar date, not UTC", () => {
    // 2026-03-01 20:00 UTC is already 2 March in Sydney (AEDT, UTC+11).
    const now = new Date("2026-03-01T20:00:00Z");
    expect(sydneyToday(now)).toBe("2026-03-02");
    expect(isInvoiceOverdue(invoice({ status: "issued", dueDate: "2026-03-01" }), now)).toBe(true);
    expect(isInvoiceOverdue(invoice({ status: "issued", dueDate: "2026-03-02" }), now)).toBe(false);
  });

  it("is never overdue when paid, void, draft or fully covered", () => {
    const now = new Date("2030-01-01T00:00:00Z");
    for (const status of ["draft", "paid", "void"] as const) {
      expect(isInvoiceOverdue(invoice({ status, dueDate: "2026-01-01" }), now)).toBe(false);
    }
    expect(isInvoiceOverdue(invoice({ status: "partially_paid", dueDate: "2026-01-01", paymentsCents: 1000 }), now)).toBe(false);
  });
});
