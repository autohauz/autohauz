import "server-only";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { BusinessProfile } from "@/config/business";
import type { Invoice, InvoiceItem, InvoiceVehicleSnapshot } from "@/lib/domain";
import { buildInvoiceView, formatAud, formatAuDate, vehicleTitle, type InvoiceView } from "@/lib/invoices/document";

/**
 * A4 invoice PDF. Renders from the shared view-model, so an issued invoice
 * prints its frozen seller/vehicle snapshot, exactly like the admin preview.
 *
 * Layout rules for long content: the line-item header row is `fixed` (repeats
 * on every page), rows never split (`wrap={false}`), descriptions wrap inside
 * their column, and the totals + payment block is kept together.
 */
const NAVY = "#0B3573";
const MUTED = "#5b6980";

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 48, paddingHorizontal: 36, fontFamily: "Helvetica", fontSize: 9.5, color: "#14213d" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  sellerName: { fontSize: 15, fontFamily: "Helvetica-Bold", color: NAVY, maxWidth: 300 },
  muted: { color: MUTED, lineHeight: 1.4 },
  titleBox: { width: 190, alignItems: "flex-end" },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", textTransform: "uppercase", marginBottom: 6 },
  draft: { fontSize: 9, color: "#a93226", fontFamily: "Helvetica-Bold", marginBottom: 4 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", width: 190, marginBottom: 3 },
  metaValue: { fontFamily: "Helvetica-Bold" },
  cards: { flexDirection: "row", gap: 12, marginBottom: 16 },
  card: { flex: 1, borderWidth: 1, borderColor: "#e3e8f0", borderRadius: 4, padding: 9 },
  cardTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: NAVY, textTransform: "uppercase", marginBottom: 5 },
  bold: { fontFamily: "Helvetica-Bold" },
  th: { flexDirection: "row", backgroundColor: "#f1f4f9", borderBottomWidth: 1, borderBottomColor: "#d0d8e4", paddingVertical: 5, paddingHorizontal: 4 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#eef1f6", paddingVertical: 6, paddingHorizontal: 4 },
  thText: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: MUTED, textTransform: "uppercase" },
  cDesc: { flex: 1, paddingRight: 8 },
  cQty: { width: 36, textAlign: "right" },
  cPrice: { width: 76, textAlign: "right" },
  cDisc: { width: 64, textAlign: "right" },
  cAmt: { width: 80, textAlign: "right" },
  totalsWrap: { flexDirection: "row", justifyContent: "flex-end", marginTop: 12 },
  totals: { width: 230 },
  totRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  grand: { borderTopWidth: 1, borderTopColor: "#d0d8e4", paddingTop: 5, marginTop: 2 },
  balance: { borderTopWidth: 2, borderTopColor: NAVY, paddingTop: 5, marginTop: 4 },
  balanceText: { fontSize: 12, fontFamily: "Helvetica-Bold", color: NAVY },
  note: { fontSize: 8, color: MUTED, marginTop: 4 },
  footer: { marginTop: 18, borderTopWidth: 1, borderTopColor: "#e3e8f0", paddingTop: 10, gap: 10 },
  pageNo: { position: "absolute", bottom: 20, left: 36, right: 36, fontSize: 8, color: MUTED, textAlign: "right" },
});

function InvoicePdf({ view, invoice }: { view: InvoiceView; invoice: Invoice }) {
  const { seller, vehicle } = view;
  const bank = seller.bank;
  const hasBank = Boolean(bank.accountName && bank.bsb && bank.accountNumber) || Boolean(bank.payId);

  return (
    <Document title={`${view.title} ${view.number}`} author={seller.legalName || seller.tradingName}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.sellerName}>{seller.legalName || seller.tradingName}</Text>
            {seller.tradingName && seller.tradingName !== seller.legalName ? <Text style={s.muted}>Trading as {seller.tradingName}</Text> : null}
            {seller.abn ? <Text style={s.muted}>ABN {seller.abn}</Text> : null}
            {seller.address ? <Text style={s.muted}>{seller.address}</Text> : null}
            <Text style={s.muted}>{[seller.phone, seller.email].filter(Boolean).join("  ·  ")}</Text>
          </View>
          <View style={s.titleBox}>
            {view.isDraft ? <Text style={s.draft}>DRAFT — NOT A VALID INVOICE</Text> : null}
            <Text style={s.title}>{view.title}</Text>
            <View style={s.metaRow}><Text style={s.muted}>Invoice no.</Text><Text style={s.metaValue}>{view.number}</Text></View>
            <View style={s.metaRow}><Text style={s.muted}>Issue date</Text><Text style={s.metaValue}>{formatAuDate(invoice.issuedAt)}</Text></View>
            <View style={s.metaRow}><Text style={s.muted}>Due date</Text><Text style={s.metaValue}>{formatAuDate(invoice.dueDate)}</Text></View>
          </View>
        </View>

        <View style={s.cards} wrap={false}>
          <View style={s.card}>
            <Text style={s.cardTitle}>Billed to</Text>
            <Text style={s.bold}>{invoice.billingName}</Text>
            {invoice.billingAddress ? <Text style={s.muted}>{invoice.billingAddress}</Text> : null}
            {invoice.billingEmail ? <Text style={s.muted}>{invoice.billingEmail}</Text> : null}
            {invoice.billingPhone ? <Text style={s.muted}>{invoice.billingPhone}</Text> : null}
            {invoice.billingAbn ? <Text style={s.muted}>ABN {invoice.billingAbn}</Text> : null}
          </View>
          {vehicle ? <VehicleCard vehicle={vehicle} /> : null}
        </View>

        <View style={s.th} fixed>
          <Text style={[s.thText, s.cDesc]}>Description</Text>
          <Text style={[s.thText, s.cQty]}>Qty</Text>
          <Text style={[s.thText, s.cPrice]}>Unit price</Text>
          <Text style={[s.thText, s.cDisc]}>Discount</Text>
          <Text style={[s.thText, s.cAmt]}>Amount</Text>
        </View>
        {view.lines.map((line) => (
          <View key={line.id} style={s.tr} wrap={false}>
            <Text style={s.cDesc}>{line.description}{line.gstFree ? " *" : ""}</Text>
            <Text style={s.cQty}>{line.quantity}</Text>
            <Text style={s.cPrice}>{formatAud(line.unitPriceCents)}</Text>
            <Text style={s.cDisc}>{line.discountCents > 0 ? `-${formatAud(line.discountCents)}` : "—"}</Text>
            <Text style={[s.cAmt, s.bold]}>{formatAud(line.amountCents)}</Text>
          </View>
        ))}

        <View style={s.totalsWrap} wrap={false}>
          <View style={s.totals}>
            <View style={s.totRow}><Text style={s.muted}>{view.subtotalLabel}</Text><Text>{formatAud(invoice.subtotalCents)}</Text></View>
            {invoice.lineDiscountsCents + invoice.invoiceDiscountCents > 0 ? (
              <View style={s.totRow}><Text style={s.muted}>Discounts</Text><Text>-{formatAud(invoice.lineDiscountsCents + invoice.invoiceDiscountCents)}</Text></View>
            ) : null}
            {invoice.gstEnabled ? (
              <>
                {view.hasGstFreeLines ? (
                  <View style={s.totRow}><Text style={s.muted}>GST-free amount</Text><Text>{formatAud(invoice.gstFreeCents)}</Text></View>
                ) : null}
                <View style={s.totRow}><Text style={s.muted}>GST ({invoice.gstRate}%)</Text><Text>{formatAud(invoice.gstCents)}</Text></View>
              </>
            ) : null}
            <View style={[s.totRow, s.grand]}><Text style={s.bold}>Total</Text><Text style={s.bold}>{formatAud(invoice.totalIncGstCents)}</Text></View>
            {invoice.paymentsCents > 0 ? (
              <View style={s.totRow}><Text style={s.muted}>Paid</Text><Text>-{formatAud(invoice.paymentsCents)}</Text></View>
            ) : null}
            <View style={[s.totRow, s.balance]}><Text style={s.balanceText}>Balance due</Text><Text style={s.balanceText}>{formatAud(view.balanceDueCents)}</Text></View>
            {view.gstNote ? <Text style={s.note}>{view.gstNote}</Text> : null}
          </View>
        </View>

        <View style={s.footer} wrap={false}>
          {hasBank ? (
            <View>
              <Text style={s.cardTitle}>How to pay</Text>
              {bank.accountName ? <Text>Account name: {bank.accountName}</Text> : null}
              {bank.bsb ? <Text>BSB: {bank.bsb}   Account: {bank.accountNumber}</Text> : null}
              {bank.payId ? <Text>PayID: {bank.payId}</Text> : null}
              <Text>Reference: {view.number}</Text>
            </View>
          ) : null}
          {invoice.paymentTerms ? (
            <View>
              <Text style={s.cardTitle}>Payment terms</Text>
              <Text style={s.muted}>{invoice.paymentTerms}</Text>
            </View>
          ) : null}
          {invoice.footerNote ? <Text style={s.muted}>{invoice.footerNote}</Text> : null}
        </View>

        <Text
          style={s.pageNo}
          fixed
          render={({ pageNumber, totalPages }) => `${view.title} ${view.number} — page ${pageNumber} of ${totalPages}`}
        />
      </Page>
    </Document>
  );
}

function VehicleCard({ vehicle }: { vehicle: InvoiceVehicleSnapshot }) {
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>Vehicle</Text>
      <Text style={s.bold}>{vehicleTitle(vehicle)}</Text>
      {vehicle.stockId ? <Text style={s.muted}>Stock no. {vehicle.stockId}</Text> : null}
      {vehicle.vin ? <Text style={s.muted}>VIN {vehicle.vin}</Text> : null}
      {vehicle.registration ? (
        <Text style={s.muted}>Rego {vehicle.registration}{vehicle.regoExpiry ? ` (expires ${formatAuDate(vehicle.regoExpiry)})` : ""}</Text>
      ) : null}
      {vehicle.odometerKm != null ? <Text style={s.muted}>Odometer {vehicle.odometerKm.toLocaleString("en-AU")} km</Text> : null}
    </View>
  );
}

export async function renderInvoicePdf(
  detail: { invoice: Invoice; items: InvoiceItem[]; vehicle: InvoiceVehicleSnapshot | null },
  profile: BusinessProfile,
): Promise<Buffer> {
  const view = buildInvoiceView({
    invoice: detail.invoice,
    items: detail.items,
    liveVehicle: detail.vehicle,
    liveProfile: profile,
  });
  return renderToBuffer(<InvoicePdf view={view} invoice={detail.invoice} />);
}
