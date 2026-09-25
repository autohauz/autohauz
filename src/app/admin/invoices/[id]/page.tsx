import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getInvoiceDetail } from "@/lib/data/invoices";
import { getBusinessProfile } from "@/lib/data/business";
import { InvoiceActions } from "./invoice-actions";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_STYLES } from "@/lib/invoices/status";
import { buildInvoiceView, formatAud, formatAuDate, vehicleTitle } from "@/lib/invoices/document";
import { PAYMENT_METHOD_LABELS } from "@/lib/validation/invoice";
import { requirePermission } from "@/lib/security/auth";
import { roleCan } from "@/lib/security/permissions";

export const metadata = { title: "Invoice" };
export const dynamic = "force-dynamic";

const EVENT_LABELS: Record<string, string> = {
  created: "Draft created",
  updated: "Draft updated",
  issued: "Issued",
  payment_recorded: "Payment recorded",
  voided: "Voided",
  emailed: "Emailed to customer",
};

export default async function InvoicePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("invoices.view");
  const { id } = await params;
  const [detail, profile] = await Promise.all([getInvoiceDetail(id), getBusinessProfile()]);
  if (!detail) notFound();

  const { invoice, items, payments, events } = detail;
  const view = buildInvoiceView({ invoice, items, liveVehicle: detail.vehicle, liveProfile: profile });
  const { seller, vehicle } = view;
  const statusKey = view.isOverdue ? "overdue" : invoice.status;
  const bank = seller.bank;
  const hasBank = Boolean(bank.accountName && bank.bsb && bank.accountNumber) || Boolean(bank.payId);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body { background: white !important; color: black !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          aside, nav { display: none !important; }
          main#main { padding: 0 !important; margin: 0 !important; max-width: 100% !important; }
          tr, .invoice-keep { break-inside: avoid; }
          thead { display: table-header-group; }
        }
      `}</style>

      <div className="flex items-center justify-between print:hidden">
        <Link href="/admin/invoices" className="inline-flex items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Back to invoices
        </Link>
      </div>

      <InvoiceActions
        id={invoice.id}
        status={invoice.status}
        balanceDueCents={view.balanceDueCents}
        billingEmail={invoice.billingEmail}
        canVoid={roleCan(user.staffRole, "invoices.void")}
      />

      {view.isDraft ? (
        <p role="note" className="rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning-foreground print:hidden">
          This is a draft. It has no invoice number and is not a valid {view.title.toLowerCase()} until it is issued.
          Business details below come from current Settings and are frozen when you issue it.
        </p>
      ) : null}

      <article className="mx-auto overflow-hidden rounded-xl border border-border bg-card shadow-md print:rounded-none print:border-none print:bg-transparent print:shadow-none" aria-label={`${view.title} ${view.number}`}>
        <div className="space-y-8 p-8 text-foreground md:p-12 print:space-y-4 print:p-0">
          <header className="flex flex-col items-start justify-between gap-6 border-b border-border pb-6 md:flex-row print:pb-4">
            <div className="space-y-1 text-sm">
              <p className="font-heading text-xl font-bold text-primary">{seller.legalName || seller.tradingName || "Business name not set"}</p>
              {seller.tradingName && seller.tradingName !== seller.legalName ? <p className="text-muted-foreground">Trading as {seller.tradingName}</p> : null}
              {seller.abn ? <p className="text-muted-foreground">ABN {seller.abn}</p> : null}
              {seller.address ? <p className="text-muted-foreground">{seller.address}</p> : null}
              <p className="text-muted-foreground">{[seller.phone, seller.email].filter(Boolean).join(" · ")}</p>
            </div>

            <div className="space-y-2 text-left md:text-right">
              <h1 className="font-heading text-3xl font-black uppercase tracking-wider">{view.title}</h1>
              <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${INVOICE_STATUS_STYLES[statusKey]}`}>
                {INVOICE_STATUS_LABELS[statusKey]}
              </span>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg border border-border/60 bg-muted/30 p-2.5 text-xs">
                <dt className="font-medium text-muted-foreground">Invoice no.</dt>
                <dd className="text-right font-bold">{view.number}</dd>
                <dt className="font-medium text-muted-foreground">Issue date</dt>
                <dd className="text-right font-semibold">{formatAuDate(invoice.issuedAt)}</dd>
                <dt className="font-medium text-muted-foreground">Due date</dt>
                <dd className="text-right font-semibold">{formatAuDate(invoice.dueDate)}</dd>
              </dl>
            </div>
          </header>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <section className="invoice-keep space-y-1 rounded-xl border border-border/60 bg-muted/20 p-4 text-sm">
              <h2 className="mb-2 border-b border-border/40 pb-1 text-xs font-bold uppercase tracking-wider text-primary">Billed to</h2>
              <p className="font-bold">{invoice.billingName}</p>
              {invoice.billingAddress ? <p className="whitespace-pre-wrap text-muted-foreground">{invoice.billingAddress}</p> : null}
              {invoice.billingEmail ? <p className="text-muted-foreground">{invoice.billingEmail}</p> : null}
              {invoice.billingPhone ? <p className="text-muted-foreground">{invoice.billingPhone}</p> : null}
              {invoice.billingAbn ? <p className="font-medium text-muted-foreground">ABN {invoice.billingAbn}</p> : null}
            </section>

            {vehicle ? (
              <section className="invoice-keep space-y-1 rounded-xl border border-border/60 bg-muted/20 p-4 text-sm">
                <h2 className="mb-2 border-b border-border/40 pb-1 text-xs font-bold uppercase tracking-wider text-primary">Vehicle</h2>
                <p className="font-bold">{vehicleTitle(vehicle)}</p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 pt-1 text-muted-foreground">
                  <dt>Stock no.</dt>
                  <dd className="font-semibold text-foreground">{vehicle.stockId || "—"}</dd>
                  <dt>VIN</dt>
                  <dd className="break-all font-mono text-xs font-semibold text-foreground">{vehicle.vin || "—"}</dd>
                  <dt>Rego</dt>
                  <dd className="font-semibold text-foreground">
                    {vehicle.registration || "—"}
                    {vehicle.regoExpiry ? ` (expires ${formatAuDate(vehicle.regoExpiry)})` : ""}
                  </dd>
                  <dt>Odometer</dt>
                  <dd className="font-semibold text-foreground">{vehicle.odometerKm != null ? `${vehicle.odometerKm.toLocaleString("en-AU")} km` : "—"}</dd>
                </dl>
              </section>
            ) : null}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">Line items</caption>
              <thead>
                <tr className="border-y border-border bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th scope="col" className="px-3 py-2.5">Description</th>
                  <th scope="col" className="w-16 px-3 py-2.5 text-right">Qty</th>
                  <th scope="col" className="w-28 px-3 py-2.5 text-right">Unit price</th>
                  <th scope="col" className="w-24 px-3 py-2.5 text-right">Discount</th>
                  <th scope="col" className="w-28 px-3 py-2.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {view.lines.map((line) => (
                  <tr key={line.id}>
                    <td className="break-words px-3 py-3 font-medium">
                      {line.description}
                      {line.gstFree ? <span className="text-muted-foreground" title="GST-free"> *</span> : null}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{line.quantity}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{formatAud(line.unitPriceCents)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                      {line.discountCents > 0 ? `-${formatAud(line.discountCents)}` : "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatAud(line.amountCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="invoice-keep flex justify-end border-t border-border pt-4">
            <dl className="w-full max-w-xs space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <dt>{view.subtotalLabel}</dt>
                <dd className="font-medium tabular-nums text-foreground">{formatAud(invoice.subtotalCents)}</dd>
              </div>
              {invoice.lineDiscountsCents + invoice.invoiceDiscountCents > 0 ? (
                <div className="flex justify-between text-muted-foreground">
                  <dt>Discounts</dt>
                  <dd className="font-medium tabular-nums text-foreground">-{formatAud(invoice.lineDiscountsCents + invoice.invoiceDiscountCents)}</dd>
                </div>
              ) : null}
              {invoice.gstEnabled ? (
                <>
                  {view.hasGstFreeLines ? (
                    <div className="flex justify-between text-muted-foreground">
                      <dt>GST-free amount</dt>
                      <dd className="font-medium tabular-nums text-foreground">{formatAud(invoice.gstFreeCents)}</dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between text-muted-foreground">
                    <dt>GST ({invoice.gstRate}%)</dt>
                    <dd className="font-medium tabular-nums text-foreground">{formatAud(invoice.gstCents)}</dd>
                  </div>
                </>
              ) : null}
              <div className="flex justify-between border-t border-border pt-2 font-bold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatAud(invoice.totalIncGstCents)}</dd>
              </div>
              {invoice.paymentsCents > 0 ? (
                <div className="flex justify-between text-muted-foreground">
                  <dt>Paid</dt>
                  <dd className="font-medium tabular-nums text-foreground">-{formatAud(invoice.paymentsCents)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between border-t-2 border-primary pt-2 text-base font-black text-primary">
                <dt>Balance due</dt>
                <dd className="tabular-nums">{formatAud(view.balanceDueCents)}</dd>
              </div>
              {view.gstNote ? <p className="pt-1 text-xs text-muted-foreground">{view.gstNote}</p> : null}
            </dl>
          </div>

          <footer className="invoice-keep grid grid-cols-1 gap-6 border-t border-border pt-6 text-sm md:grid-cols-2">
            {hasBank ? (
              <section className="rounded-xl border border-border/60 bg-muted/20 p-3.5">
                <h2 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-primary">How to pay</h2>
                <dl className="grid grid-cols-[110px_1fr] gap-x-2 gap-y-1 text-muted-foreground">
                  {bank.accountName ? (<><dt>Account name</dt><dd className="font-semibold text-foreground">{bank.accountName}</dd></>) : null}
                  {bank.bsb ? (<><dt>BSB</dt><dd className="font-semibold tabular-nums text-foreground">{bank.bsb}</dd></>) : null}
                  {bank.accountNumber ? (<><dt>Account no.</dt><dd className="font-semibold tabular-nums text-foreground">{bank.accountNumber}</dd></>) : null}
                  {bank.payId ? (<><dt>PayID</dt><dd className="font-semibold text-foreground">{bank.payId}</dd></>) : null}
                  <dt>Reference</dt>
                  <dd className="font-bold text-primary">{view.number}</dd>
                </dl>
              </section>
            ) : null}
            {invoice.paymentTerms ? (
              <section className="space-y-1">
                <h2 className="text-xs font-bold uppercase tracking-wider text-primary">Payment terms</h2>
                <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">{invoice.paymentTerms}</p>
              </section>
            ) : null}
            {invoice.footerNote ? <p className="text-center text-xs italic text-muted-foreground md:col-span-2">{invoice.footerNote}</p> : null}
          </footer>
        </div>
      </article>

      {payments.length > 0 ? (
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm print:hidden" aria-labelledby="payments-heading">
          <h2 id="payments-heading" className="mb-4 text-lg font-semibold">Payments</h2>
          <ul className="divide-y divide-border/50">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium tabular-nums">{formatAud(p.amountCents)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatAuDate(p.paymentDate)} · {PAYMENT_METHOD_LABELS[p.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS] ?? p.paymentMethod}
                    {p.referenceNumber ? ` · Ref ${p.referenceNumber}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {events.length > 0 ? (
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm print:hidden" aria-labelledby="history-heading">
          <h2 id="history-heading" className="mb-4 text-lg font-semibold">History</h2>
          <ol className="space-y-2 text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap gap-x-3 text-muted-foreground">
                <time dateTime={e.createdAt} className="tabular-nums">
                  {new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", dateStyle: "medium", timeStyle: "short" }).format(new Date(e.createdAt))}
                </time>
                <span className="font-medium text-foreground">{EVENT_LABELS[e.event] ?? e.event}</span>
                {typeof e.data.reason === "string" ? <span>— {e.data.reason}</span> : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
