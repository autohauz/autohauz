import { NextRequest, NextResponse } from "next/server";
import { getInvoiceDetail } from "@/lib/data/invoices";
import { getBusinessProfile } from "@/lib/data/business";
import { requireApiPermission } from "@/lib/security/auth";
import { renderInvoicePdf } from "@/lib/invoices/pdf";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { response } = await requireApiPermission("invoices.view");
  if (response) return response;

  const { id } = await props.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  try {
    const detail = await getInvoiceDetail(id);
    if (!detail) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    const pdf = await renderInvoicePdf(detail, await getBusinessProfile());
    const number = (detail.invoice.invoiceNumber ?? "draft").replace(/[^A-Za-z0-9-]/g, "");
    const disposition = req.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="invoice-${number}.pdf"`,
        // Contains customer PII and bank details: never cache.
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[invoices] PDF generation failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}
