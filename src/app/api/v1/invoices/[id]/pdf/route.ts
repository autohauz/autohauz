import * as React from "react";
import { NextRequest, NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import { getInvoiceDetail } from "@/lib/data/invoices";
import { getBusinessProfile } from "@/lib/data/business";
import { requireApiAdmin } from "@/lib/security/auth";
import { InvoiceDocument } from "./invoice-document";

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { response } = await requireApiAdmin();
  if (response) return response;

  const { id } = await props.params;

  try {
    const detail = await getInvoiceDetail(id);
    if (!detail) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }
    const profile = await getBusinessProfile();

    // Create the PDF stream using react-pdf/renderer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream = await renderToStream(
      React.createElement(InvoiceDocument, {
        invoice: detail.invoice,
        items: detail.items,
        profile,
      }) as React.ReactElement<any>
    );

    // Provide the stream to the response
    return new NextResponse(stream as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="invoice-${detail.invoice.invoiceNumber || "draft"}.pdf"`,
      },
    });
  } catch (error) {
    console.error("PDF generation failed:", error);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}
