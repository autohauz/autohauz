import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { getInvoiceDetail } from "@/lib/data/invoices";
import { getBusinessProfile } from "@/lib/data/business";
import { InvoiceActions } from "./invoice-actions";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_STYLES } from "@/lib/invoices/status";

export const metadata = { title: "Invoice Preview" };
export const dynamic = "force-dynamic";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(cents / 100);
}

export default async function InvoicePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getInvoiceDetail(id);
  
  if (!detail) {
    notFound();
  }

  const { invoice, items, payments, vehicle } = detail;
  const profile = await getBusinessProfile();
  const balanceDueCents = Math.max(0, invoice.totalIncGstCents - invoice.paymentsCents);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 10mm;
          }
          body {
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          aside, nav, .print\\:hidden {
            display: none !important;
          }
          main#main {
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
        }
      `}</style>

      <div className="flex items-center justify-between print:hidden">
        <Link 
          href="/admin/invoices" 
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back to Invoices
        </Link>
      </div>

      <InvoiceActions id={invoice.id} status={invoice.status} />

      {/* Main Invoice Sheet */}
      <div className="bg-card border border-border shadow-md rounded-xl mx-auto overflow-hidden print:shadow-none print:border-none print:bg-transparent print:rounded-none">
        <div className="p-8 md:p-12 print:p-0 space-y-8 print:space-y-4 text-foreground">
          
          {/* Header Bar */}
          <div className="flex flex-col md:flex-row justify-between items-start gap-6 border-b border-border pb-6 print:pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-heading text-2xl font-black tracking-tight text-primary uppercase">AutoHauz</span>
                <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-semibold uppercase tracking-widest">Dealership</span>
              </div>
              <p className="font-semibold text-foreground text-sm">{profile.legalName || "AutoHauz Pty Ltd"}</p>
              {profile.abn && <p className="text-xs text-muted-foreground">ABN: {profile.abn}</p>}
              <p className="text-xs text-muted-foreground">
                {[profile.address?.street, profile.address?.suburb, profile.address?.state, profile.address?.postcode].filter(Boolean).join(" ")}
              </p>
              <p className="text-xs text-muted-foreground">{profile.email} • {profile.phone}</p>
            </div>
            
            <div className="text-left md:text-right space-y-2">
              <div className="flex flex-col items-start md:items-end gap-1">
                <span className="text-3xl font-black font-heading tracking-wider uppercase text-foreground">
                  {invoice.gstEnabled ? "Tax Invoice" : "Invoice"}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${INVOICE_STATUS_STYLES[invoice.status === "issued" && balanceDueCents > 0 && invoice.dueDate && invoice.dueDate < new Date().toISOString().split("T")[0] ? "overdue" : invoice.status]}`}>
                  {INVOICE_STATUS_LABELS[invoice.status === "issued" && balanceDueCents > 0 && invoice.dueDate && invoice.dueDate < new Date().toISOString().split("T")[0] ? "overdue" : invoice.status]}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-3 bg-muted/30 print:bg-slate-50 p-2.5 rounded-lg border border-border/60">
                <div className="text-muted-foreground font-medium">Invoice No:</div>
                <div className="font-bold text-foreground text-right">{invoice.invoiceNumber || "DRAFT"}</div>
                
                <div className="text-muted-foreground font-medium">Issue Date:</div>
                <div className="font-semibold text-right">{invoice.issuedAt ? format(new Date(invoice.issuedAt), "dd MMM yyyy") : "—"}</div>
                
                <div className="text-muted-foreground font-medium">Due Date:</div>
                <div className="font-semibold text-right">{invoice.dueDate ? format(new Date(invoice.dueDate), "dd MMM yyyy") : "—"}</div>
              </div>
            </div>
          </div>

          {/* Customer & Vehicle Info Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Bill To */}
            <div className="bg-muted/20 print:bg-slate-50 p-4 rounded-xl border border-border/60 space-y-1 text-xs">
              <h2 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border/40 pb-1 mb-2">Billed To</h2>
              <p className="font-bold text-foreground text-sm">{invoice.billingName}</p>
              {invoice.billingEmail && <p className="text-muted-foreground">{invoice.billingEmail}</p>}
              {invoice.billingPhone && <p className="text-muted-foreground">{invoice.billingPhone}</p>}
              {invoice.billingAddress && <p className="text-muted-foreground whitespace-pre-wrap">{invoice.billingAddress}</p>}
              {invoice.billingAbn && <p className="text-muted-foreground font-medium">ABN: {invoice.billingAbn}</p>}
            </div>

            {/* Vehicle Particulars (If linked) */}
            {vehicle ? (
              <div className="bg-muted/20 print:bg-slate-50 p-4 rounded-xl border border-border/60 space-y-1 text-xs">
                <h2 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border/40 pb-1 mb-2">Vehicle Particulars</h2>
                <p className="font-bold text-foreground text-sm">{vehicle.year} {vehicle.makeName} {vehicle.modelName} {vehicle.variant || ""}</p>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-muted-foreground pt-1">
                  <div>Stock No: <span className="font-semibold text-foreground">{vehicle.stockId || "—"}</span></div>
                  <div>VIN: <span className="font-semibold text-foreground font-mono text-[11px]">{vehicle.vin || "—"}</span></div>
                  <div>Rego: <span className="font-semibold text-foreground">{vehicle.registration || "—"}</span></div>
                  <div>Odometer: <span className="font-semibold text-foreground">{vehicle.mileageKm ? `${vehicle.mileageKm.toLocaleString()} km` : "—"}</span></div>
                </div>
              </div>
            ) : (
              <div className="bg-muted/20 print:bg-slate-50 p-4 rounded-xl border border-border/60 text-xs flex flex-col justify-center">
                <h2 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border/40 pb-1 mb-2">Payment Details</h2>
                <p className="text-muted-foreground">Reference: <span className="font-bold text-foreground">{invoice.invoiceNumber || "DRAFT"}</span></p>
                <p className="text-muted-foreground mt-1">Please quote invoice number on all payments and correspondence.</p>
              </div>
            )}
          </div>

          {/* Line Items Table */}
          <div className="pt-2">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-muted/50 print:bg-slate-100 border-y border-border text-muted-foreground uppercase tracking-wider font-semibold">
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3 text-right w-16">Qty</th>
                  <th className="py-2.5 px-3 text-right w-24">Unit Price</th>
                  <th className="py-2.5 px-3 text-right w-20">Discount</th>
                  <th className="py-2.5 px-3 text-right w-28">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/20">
                    <td className="py-3 px-3 font-medium text-foreground">{item.description}</td>
                    <td className="py-3 px-3 text-right tabular-nums text-muted-foreground">{item.quantity}</td>
                    <td className="py-3 px-3 text-right tabular-nums text-muted-foreground">{formatCurrency(item.unitPriceCents)}</td>
                    <td className="py-3 px-3 text-right tabular-nums text-muted-foreground">
                      {item.discountCents > 0 ? `-${formatCurrency(item.discountCents)}` : "—"}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums font-semibold text-foreground">
                      {formatCurrency((item.unitPriceCents * item.quantity) - item.discountCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Totals Block */}
          <div className="flex justify-end pt-4 border-t border-border print:break-inside-avoid">
            <div className="w-full max-w-xs space-y-2 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal (ex GST)</span>
                <span className="tabular-nums font-medium text-foreground">{formatCurrency(invoice.subtotalCents)}</span>
              </div>
              
              {(invoice.lineDiscountsCents > 0 || invoice.invoiceDiscountCents > 0) && (
                <div className="flex justify-between text-success">
                  <span>Total Discount</span>
                  <span className="tabular-nums font-medium">-{formatCurrency(invoice.lineDiscountsCents + invoice.invoiceDiscountCents)}</span>
                </div>
              )}
              
              {invoice.gstEnabled ? (
                <div className="flex justify-between text-muted-foreground">
                  <span>GST ({invoice.gstRate}%)</span>
                  <span className="tabular-nums font-medium text-foreground">{formatCurrency(invoice.gstCents)}</span>
                </div>
              ) : (
                <div className="flex justify-between text-muted-foreground">
                  <span>GST</span>
                  <span className="tabular-nums font-medium text-foreground">$0.00 (No GST)</span>
                </div>
              )}
              
              <div className="flex justify-between text-sm font-bold pt-2 border-t border-border text-foreground">
                <span>Total Amount</span>
                <span className="tabular-nums">{formatCurrency(invoice.totalIncGstCents)}</span>
              </div>
              
              {invoice.paymentsCents > 0 && (
                <div className="flex justify-between text-success font-medium">
                  <span>Amount Paid / Deposit</span>
                  <span className="tabular-nums">-{formatCurrency(invoice.paymentsCents)}</span>
                </div>
              )}
              
              <div className="flex justify-between text-base font-black pt-2 border-t-2 border-primary text-primary">
                <span>Balance Due</span>
                <span className="tabular-nums">{formatCurrency(balanceDueCents)}</span>
              </div>
            </div>
          </div>

          {/* Footer, Bank Details & Delivery Acceptance */}
          <div className="pt-6 border-t border-border space-y-6 text-xs print:break-inside-avoid">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* EFT Payment Details */}
              {profile.invoice.bank.accountName && (
                <div className="bg-muted/20 print:bg-slate-50 p-3.5 rounded-xl border border-border/60">
                  <h3 className="font-bold text-foreground mb-1.5 uppercase text-[11px] tracking-wider text-primary">Direct Deposit / Bank Transfer</h3>
                  <div className="grid grid-cols-[90px_1fr] gap-x-2 gap-y-1 text-muted-foreground">
                    <div>Bank:</div><div className="font-semibold text-foreground">Westpac Banking Corporation</div>
                    <div>Account Name:</div><div className="font-semibold text-foreground">{profile.invoice.bank.accountName}</div>
                    <div>BSB:</div><div className="font-semibold text-foreground tabular-nums">{profile.invoice.bank.bsb}</div>
                    <div>Account No:</div><div className="font-semibold text-foreground tabular-nums">{profile.invoice.bank.accountNumber}</div>
                    {profile.invoice.bank.payId && (
                      <><div>PayID:</div><div className="font-semibold text-foreground">{profile.invoice.bank.payId}</div></>
                    )}
                    <div>Reference:</div><div className="font-bold text-primary">{invoice.invoiceNumber || "INV-DRAFT"}</div>
                  </div>
                </div>
              )}

              {/* Payment Terms & Retention of Title */}
              <div className="space-y-2">
                <h3 className="font-bold text-foreground uppercase text-[11px] tracking-wider text-primary">Terms & Conditions</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {invoice.paymentTerms || "Payment is strictly required on or before the due date. Title to goods remains with AutoHauz Pty Ltd until payment has been cleared in full."}
                </p>
                <p className="text-[10px] text-muted-foreground italic">
                  Statutory consumer guarantees apply under the Australian Consumer Law.
                </p>
              </div>
            </div>

            {/* Delivery / Customer Acceptance Signature Box */}
            <div className="pt-4 border-t border-border/50 grid grid-cols-2 gap-12 print:pt-3">
              <div className="space-y-8">
                <div className="border-b border-muted-foreground/40 pb-1"></div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold text-center">Authorized AutoHauz Representative Signature</p>
              </div>
              <div className="space-y-8">
                <div className="border-b border-muted-foreground/40 pb-1"></div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold text-center">Customer Acceptance Signature & Date</p>
              </div>
            </div>
            
            {invoice.footerNote && (
              <p className="text-center text-muted-foreground text-[11px] italic pt-2">
                {invoice.footerNote}
              </p>
            )}
          </div>
          
        </div>
      </div>
      
      {/* Payments History section (hidden in print) */}
      {payments.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm print:hidden">
          <h3 className="font-semibold text-lg mb-4">Payment History</h3>
          <div className="space-y-3">
            {payments.map(p => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <div>
                  <p className="font-medium">{formatCurrency(p.amountCents)}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(p.paymentDate), "dd MMM yyyy")} • {p.paymentMethod} {p.referenceNumber ? `(${p.referenceNumber})` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
