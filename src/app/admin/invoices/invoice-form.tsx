"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createInvoiceDraft, updateInvoiceDraft } from "./actions";
import type { InvoiceDraftPayload } from "@/lib/validation/invoice";
import { calculateInvoiceTotals } from "@/lib/invoices/calc";
import { formatAud } from "@/lib/invoices/document";
import type { Invoice, InvoiceItem } from "@/lib/domain";

interface InvoiceFormProps {
  initialData?: {
    invoice: Invoice;
    items: InvoiceItem[];
  };
  invoiceSettings: {
    gstEnabled: boolean;
    gstRate: number;
    pricesIncludeGst: boolean;
    paymentTerms: string;
    footerNote: string;
  };
  vehicles: { id: string; label: string }[];
}

type LineState = {
  key: string;
  description: string;
  quantityStr: string;
  unitPriceStr: string;
  discountStr: string;
  gstApplicable: boolean;
};

/** Dollars text → integer cents; blank/invalid → 0 (the server re-validates). */
function toCents(value: string): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}

const newLine = (): LineState => ({
  key: crypto.randomUUID(),
  description: "",
  quantityStr: "1",
  unitPriceStr: "",
  discountStr: "",
  gstApplicable: true,
});

export function InvoiceForm({ initialData, invoiceSettings, vehicles }: InvoiceFormProps) {
  const router = useRouter();
  const isEditing = !!initialData;
  const [isPending, startTransition] = useTransition();

  const [lines, setLines] = useState<LineState[]>(
    initialData?.items?.length
      ? initialData.items.map((item) => ({
          key: crypto.randomUUID(),
          description: item.description,
          quantityStr: String(item.quantity),
          unitPriceStr: (item.unitPriceCents / 100).toFixed(2),
          discountStr: item.discountCents ? (item.discountCents / 100).toFixed(2) : "",
          gstApplicable: item.gstApplicable,
        }))
      : [newLine()],
  );

  const [invoiceDiscountStr, setInvoiceDiscountStr] = useState(
    initialData?.invoice.invoiceDiscountCents ? (initialData.invoice.invoiceDiscountCents / 100).toFixed(2) : "",
  );

  const updateLine = (index: number, patch: Partial<LineState>) =>
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  const parsedLines = lines.map((l, idx) => ({
    description: l.description.trim(),
    quantity: Math.max(1, Number.parseInt(l.quantityStr, 10) || 1),
    unitPriceCents: toCents(l.unitPriceStr),
    discountCents: toCents(l.discountStr),
    gstApplicable: l.gstApplicable,
    sortOrder: idx,
  }));
  const invoiceDiscountCents = toCents(invoiceDiscountStr);

  const totals = calculateInvoiceTotals({ lines: parsedLines, invoiceDiscountCents, settings: invoiceSettings });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const text = (name: string) => ((formData.get(name) as string | null) ?? "").trim() || null;

    const payload: InvoiceDraftPayload = {
      leadId: initialData?.invoice.leadId ?? null,
      vehicleId: text("vehicleId"),
      billingName: text("billingName") ?? "",
      billingEmail: text("billingEmail") ?? "",
      billingPhone: text("billingPhone"),
      billingAddress: text("billingAddress"),
      billingAbn: text("billingAbn"),
      dueDate: text("dueDate"),
      notes: text("notes"),
      paymentTerms: text("paymentTerms"),
      footerNote: text("footerNote"),
      invoiceDiscountCents,
      items: parsedLines,
    };

    startTransition(async () => {
      const res = isEditing ? await updateInvoiceDraft(initialData.invoice.id, payload) : await createInvoiceDraft(payload);
      if (res.status === "error") {
        toast.error(res.message);
      } else {
        toast.success(res.message);
        router.push(`/admin/invoices/${res.id}`);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="grid items-start gap-8 lg:grid-cols-[1fr_360px]" aria-busy={isPending}>
      <div className="space-y-6">
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Billing details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="billingName">Customer name *</Label>
              <Input id="billingName" name="billingName" required maxLength={200} autoComplete="off" defaultValue={initialData?.invoice.billingName} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="billingEmail">Email</Label>
                <Input id="billingEmail" name="billingEmail" type="email" maxLength={254} defaultValue={initialData?.invoice.billingEmail ?? ""} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="billingPhone">Phone</Label>
                <Input id="billingPhone" name="billingPhone" type="tel" maxLength={40} defaultValue={initialData?.invoice.billingPhone ?? ""} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="billingAddress">Address</Label>
              <Textarea id="billingAddress" name="billingAddress" rows={2} maxLength={500} defaultValue={initialData?.invoice.billingAddress ?? ""} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="billingAbn">Customer ABN (if a business)</Label>
                <Input id="billingAbn" name="billingAbn" inputMode="numeric" maxLength={14} defaultValue={initialData?.invoice.billingAbn ?? ""} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dueDate">Due date</Label>
                <Input id="dueDate" name="dueDate" type="date" defaultValue={initialData?.invoice.dueDate ?? ""} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vehicleId">Vehicle</Label>
              <Select id="vehicleId" name="vehicleId" defaultValue={initialData?.invoice.vehicleId ?? ""}>
                <option value="">No vehicle</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">
                Stock number, VIN, rego and odometer are printed on the invoice and frozen when it is issued.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Line items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="space-y-4">
              {lines.map((line, index) => {
                const id = (field: string) => `line-${line.key}-${field}`;
                return (
                  <li key={line.key} className="rounded-xl border border-border p-4">
                    <div className="flex flex-col items-start gap-3 sm:flex-row">
                      <div className="grid w-full flex-1 gap-2">
                        <Label htmlFor={id("desc")}>Description *</Label>
                        <Input
                          id={id("desc")}
                          required
                          maxLength={500}
                          value={line.description}
                          onChange={(e) => updateLine(index, { description: e.target.value })}
                        />
                      </div>
                      <div className="grid w-24 shrink-0 gap-2">
                        <Label htmlFor={id("qty")}>Qty *</Label>
                        <Input
                          id={id("qty")}
                          type="number"
                          inputMode="numeric"
                          min="1"
                          max="10000"
                          step="1"
                          required
                          value={line.quantityStr}
                          onChange={(e) => updateLine(index, { quantityStr: e.target.value })}
                        />
                      </div>
                      <div className="grid w-32 shrink-0 gap-2">
                        <Label htmlFor={id("price")}>Unit price ($) *</Label>
                        <Input
                          id={id("price")}
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          required
                          value={line.unitPriceStr}
                          onChange={(e) => updateLine(index, { unitPriceStr: e.target.value })}
                        />
                      </div>
                      <div className="grid w-28 shrink-0 gap-2">
                        <Label htmlFor={id("disc")}>Discount ($)</Label>
                        <Input
                          id={id("disc")}
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          value={line.discountStr}
                          onChange={(e) => updateLine(index, { discountStr: e.target.value })}
                        />
                      </div>
                      {lines.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove line ${index + 1}${line.description ? `: ${line.description}` : ""}`}
                          className="mt-6 shrink-0 text-danger hover:bg-danger/10 hover:text-danger"
                          onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                    {invoiceSettings.gstEnabled ? (
                      <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          checked={line.gstApplicable}
                          onChange={(e) => updateLine(index, { gstApplicable: e.target.checked })}
                        />
                        GST applies to this line
                        <span className="text-xs">(untick for GST-free items)</span>
                      </label>
                    ) : null}
                  </li>
                );
              })}
            </ol>

            <Button type="button" variant="outline" className="w-full border-dashed" onClick={() => setLines((prev) => [...prev, newLine()])}>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" /> Add line
            </Button>
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Notes &amp; terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="notes">Internal notes (not printed)</Label>
              <Textarea id="notes" name="notes" rows={2} maxLength={2000} defaultValue={initialData?.invoice.notes ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="paymentTerms">Payment terms</Label>
              <Textarea
                id="paymentTerms"
                name="paymentTerms"
                rows={3}
                maxLength={2000}
                defaultValue={initialData ? initialData.invoice.paymentTerms ?? "" : invoiceSettings.paymentTerms}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="footerNote">Footer note</Label>
              <Textarea
                id="footerNote"
                name="footerNote"
                rows={2}
                maxLength={500}
                defaultValue={initialData ? initialData.invoice.footerNote ?? "" : invoiceSettings.footerNote}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="lg:sticky lg:top-24">
        <Card variant="elevated" className="border-border">
          <CardHeader className="border-b border-border/50 bg-muted/30">
            <CardTitle>Totals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {invoiceSettings.gstEnabled && invoiceSettings.pricesIncludeGst ? "Subtotal (inc. GST)" : "Subtotal"}
              </span>
              <span className="font-medium tabular-nums">{formatAud(totals.subtotalCents)}</span>
            </div>

            {totals.lineDiscountsCents > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Line discounts</span>
                <span className="font-medium tabular-nums">-{formatAud(totals.lineDiscountsCents)}</span>
              </div>
            )}

            <div className="grid gap-2 border-t border-border/50 pt-2">
              <Label htmlFor="invoiceDiscount">Additional discount ($)</Label>
              <Input
                id="invoiceDiscount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={invoiceDiscountStr}
                onChange={(e) => setInvoiceDiscountStr(e.target.value)}
              />
            </div>

            {invoiceSettings.gstEnabled && (
              <>
                {totals.gstFreeCents > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">GST-free amount</span>
                    <span className="font-medium tabular-nums">{formatAud(totals.gstFreeCents)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">GST ({invoiceSettings.gstRate}%)</span>
                  <span className="font-medium tabular-nums">{formatAud(totals.gstCents)}</span>
                </div>
              </>
            )}

            <div className="flex justify-between border-t border-border/50 pt-4 text-lg font-bold">
              <span>Total</span>
              <span className="tabular-nums" aria-live="polite">
                {formatAud(totals.totalIncGstCents)}
              </span>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              {!invoiceSettings.gstEnabled
                ? "GST is not charged (Settings → Invoices)."
                : invoiceSettings.pricesIncludeGst
                  ? "Prices entered include GST."
                  : "Prices entered exclude GST."}
            </p>

            <Button type="submit" size="cta" disabled={isPending} className="mt-4 w-full">
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="mr-2 h-4 w-4" aria-hidden="true" />}
              {isEditing ? "Save draft" : "Create draft"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
