/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { Page, Text, View, Document, StyleSheet } from "@react-pdf/renderer";
import { format } from "date-fns";
import type { Invoice, InvoiceItem } from "@/lib/domain";

// Register fonts if needed. We'll use standard fonts for simplicity.
// Font.register({ family: 'Helvetica', fonts: [{ src: 'Helvetica' }] });

const styles = StyleSheet.create({
  page: { padding: 30, fontFamily: "Helvetica", fontSize: 10, color: "#333" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  logoText: { fontSize: 24, fontWeight: "bold", textTransform: "uppercase" },
  companyInfo: { marginTop: 10, color: "#666", lineHeight: 1.4 },
  invoiceTitle: { fontSize: 20, fontWeight: "bold", textTransform: "uppercase", marginBottom: 5 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  metaLabel: { color: "#666", width: 80 },
  metaValue: { fontWeight: "bold", textAlign: "right" },
  billTo: { marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: "#eee" },
  billToTitle: { fontSize: 10, fontWeight: "bold", textTransform: "uppercase", color: "#666", marginBottom: 10 },
  billToText: { lineHeight: 1.4, fontSize: 11 },
  table: { marginTop: 20, width: "100%" },
  tableHeader: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#eee", paddingBottom: 5, marginBottom: 10 },
  tableRow: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f5f5f5" },
  colDesc: { flex: 1 },
  colQty: { width: 50, textAlign: "right" },
  colPrice: { width: 80, textAlign: "right" },
  colDisc: { width: 70, textAlign: "right", color: "#666" },
  colAmount: { width: 80, textAlign: "right", fontWeight: "bold" },
  colHeader: { fontSize: 9, fontWeight: "bold", color: "#666", textTransform: "uppercase" },
  totalsArea: { marginTop: 15, flexDirection: "row", justifyContent: "flex-end" },
  totalsBox: { width: 200 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  totalLabel: { color: "#666" },
  totalValue: { fontWeight: "bold" },
  totalLine: { borderTopWidth: 1, borderTopColor: "#eee", paddingTop: 6, marginTop: 4 },
  grandTotalLabel: { fontSize: 14, fontWeight: "bold" },
  grandTotalValue: { fontSize: 14, fontWeight: "bold" },
  balanceDueBox: { borderTopWidth: 2, borderTopColor: "#0B3573", paddingTop: 8, marginTop: 6 },
  balanceDueLabel: { fontSize: 14, fontWeight: "bold", color: "#0B3573" },
  balanceDueValue: { fontSize: 14, fontWeight: "bold", color: "#0B3573" },
  footer: { marginTop: 20, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#eee", fontSize: 9 },
  termsTitle: { fontWeight: "bold", marginBottom: 4 },
  termsText: { color: "#666", lineHeight: 1.4 },
  bankBox: { marginTop: 20, backgroundColor: "#f9fafb", padding: 10, borderRadius: 4 },
  bankRow: { flexDirection: "row", marginBottom: 3 },
  bankLabel: { width: 80, color: "#666" },
  bankValue: { fontWeight: "bold" },
  footerNote: { marginTop: 15, textAlign: "center", color: "#999", fontStyle: "italic" },
  pageNumber: { position: "absolute", bottom: 20, right: 30, fontSize: 9, color: "#999" },
});

function formatCurrency(cents: number) {
  return "$" + (cents / 100).toFixed(2);
}

export const InvoiceDocument = ({ 
  invoice, items, profile 
}: { 
  invoice: Invoice; items: InvoiceItem[]; profile: Record<string, unknown>; 
}) => {
  const balanceDueCents = Math.max(0, invoice.totalIncGstCents - invoice.paymentsCents);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.logoText}>{String(profile.legalName || "AutoHauz")}</Text>
            <View style={styles.companyInfo}>
              {Boolean(profile.abn) && <Text>ABN: {String(profile.abn)}</Text>}
              <Text>{[
                (profile.address as any)?.street, 
                (profile.address as any)?.suburb, 
                (profile.address as any)?.state, 
                (profile.address as any)?.postcode
              ].filter(Boolean).join(" ")}</Text>
              <Text>{String(profile.email)} {Boolean(profile.phone) ? `• ${String(profile.phone)}` : ""}</Text>
            </View>
          </View>
          <View style={{ width: 200 }}>
            <Text style={styles.invoiceTitle}>{invoice.gstEnabled ? "TAX INVOICE" : "INVOICE"}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Invoice No:</Text>
              <Text style={styles.metaValue}>{invoice.invoiceNumber || "DRAFT"}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Issue Date:</Text>
              <Text style={styles.metaValue}>{invoice.issuedAt ? format(new Date(invoice.issuedAt), "dd MMM yyyy") : "—"}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Due Date:</Text>
              <Text style={styles.metaValue}>{invoice.dueDate ? format(new Date(invoice.dueDate), "dd MMM yyyy") : "—"}</Text>
            </View>
          </View>
        </View>

        <View style={styles.billTo}>
          <Text style={styles.billToTitle}>Bill To</Text>
          <View style={styles.billToText}>
            <Text style={{ fontWeight: "bold", fontSize: 13, marginBottom: 4 }}>{invoice.billingName}</Text>
            {invoice.billingEmail && <Text>{invoice.billingEmail}</Text>}
            {invoice.billingPhone && <Text>{invoice.billingPhone}</Text>}
            {invoice.billingAddress && <Text>{invoice.billingAddress}</Text>}
            {invoice.billingAbn && <Text>ABN: {invoice.billingAbn}</Text>}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.colDesc, styles.colHeader]}>Description</Text>
            <Text style={[styles.colQty, styles.colHeader]}>Qty</Text>
            <Text style={[styles.colPrice, styles.colHeader]}>Unit Price</Text>
            <Text style={[styles.colDisc, styles.colHeader]}>Discount</Text>
            <Text style={[styles.colAmount, styles.colHeader]}>Amount</Text>
          </View>
          {items.map((item) => (
            <View key={item.id} style={styles.tableRow}>
              <Text style={styles.colDesc}>{item.description}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colPrice}>{formatCurrency(item.unitPriceCents)}</Text>
              <Text style={styles.colDisc}>{item.discountCents > 0 ? `-${formatCurrency(item.discountCents)}` : "—"}</Text>
              <Text style={styles.colAmount}>{formatCurrency((item.unitPriceCents * item.quantity) - item.discountCents)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsArea} wrap={false}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>{formatCurrency(invoice.subtotalCents)}</Text>
            </View>
            {(invoice.lineDiscountsCents > 0 || invoice.invoiceDiscountCents > 0) && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Discount</Text>
                <Text style={styles.totalValue}>-{formatCurrency(invoice.lineDiscountsCents + invoice.invoiceDiscountCents)}</Text>
              </View>
            )}
            {invoice.gstEnabled && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>GST ({invoice.gstRate}%)</Text>
                <Text style={styles.totalValue}>{formatCurrency(invoice.gstCents)}</Text>
              </View>
            )}
            <View style={[styles.totalRow, styles.totalLine]}>
              <Text style={styles.grandTotalLabel}>Total</Text>
              <Text style={styles.grandTotalValue}>{formatCurrency(invoice.totalIncGstCents)}</Text>
            </View>
            {invoice.paymentsCents > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Amount Paid</Text>
                <Text style={styles.totalValue}>-{formatCurrency(invoice.paymentsCents)}</Text>
              </View>
            )}
            <View style={[styles.totalRow, styles.balanceDueBox]}>
              <Text style={styles.balanceDueLabel}>Balance Due</Text>
              <Text style={styles.balanceDueValue}>{formatCurrency(balanceDueCents)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer} wrap={false}>
          {invoice.paymentTerms && (
            <View style={{ marginBottom: 10 }}>
              <Text style={styles.termsTitle}>Payment Terms</Text>
              <Text style={styles.termsText}>{invoice.paymentTerms}</Text>
            </View>
          )}

          {(profile.invoice as any)?.bank?.accountName && (
            <View style={styles.bankBox}>
              <Text style={[styles.termsTitle, { marginBottom: 8 }]}>EFT Payment Details</Text>
              <View style={styles.bankRow}>
                <Text style={styles.bankLabel}>Account Name:</Text>
                <Text style={styles.bankValue}>{String((profile.invoice as any).bank.accountName)}</Text>
              </View>
              <View style={styles.bankRow}>
                <Text style={styles.bankLabel}>BSB:</Text>
                <Text style={styles.bankValue}>{String((profile.invoice as any).bank.bsb)}</Text>
              </View>
              <View style={styles.bankRow}>
                <Text style={styles.bankLabel}>Account No:</Text>
                <Text style={styles.bankValue}>{String((profile.invoice as any).bank.accountNumber)}</Text>
              </View>
              {(profile.invoice as any).bank.payId && (
                <View style={styles.bankRow}>
                  <Text style={styles.bankLabel}>PayID:</Text>
                  <Text style={styles.bankValue}>{String((profile.invoice as any).bank.payId)}</Text>
                </View>
              )}
            </View>
          )}

          {invoice.footerNote && (
            <Text style={styles.footerNote}>{invoice.footerNote}</Text>
          )}
        </View>

        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Invoice ${invoice.invoiceNumber || "DRAFT"} — Page ${pageNumber} of ${totalPages}`} fixed />
      </Page>
    </Document>
  );
};
