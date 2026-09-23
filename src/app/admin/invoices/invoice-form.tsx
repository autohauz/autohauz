"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createInvoiceDraft, updateInvoiceDraft } from "./actions";
import type { InvoiceDraftPayload } from "@/lib/validation/invoice";
import { calculateInvoiceTotals } from "@/lib/invoices/calc";
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
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(cents / 100);
}

export function InvoiceForm({ initialData, invoiceSettings }: InvoiceFormProps) {
  const router = useRouter();
  const isEditing = !!initialData;
  const [isPending, startTransition] = useTransition();

  const [items, setItems] = useState(
    initialData?.items?.map((item) => ({
      id: crypto.randomUUID(),
      description: item.description,
      quantity: item.quantity,
      unitPriceStr: (item.unitPriceCents / 100).toFixed(2),
      discountStr: (item.discountCents / 100).toFixed(2),
    })) ?? [
      { id: crypto.randomUUID(), description: "", quantity: 1, unitPriceStr: "0.00", discountStr: "0.00" },
    ]
  );

  const [invoiceDiscountStr, setInvoiceDiscountStr] = useState(
    initialData ? (initialData.invoice.invoiceDiscountCents / 100).toFixed(2) : "0.00"
  );

  const parsedItems = items.map(item => ({
    description: item.description,
    quantity: item.quantity,
    unitPriceCents: Math.round(parseFloat(item.unitPriceStr || "0") * 100),
    discountCents: Math.round(parseFloat(item.discountStr || "0") * 100),
  }));
  const invoiceDiscountCents = Math.round(parseFloat(invoiceDiscountStr || "0") * 100);

  const totals = calculateInvoiceTotals({
    lines: parsedItems,
    invoiceDiscountCents,
    settings: invoiceSettings,
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const payload: InvoiceDraftPayload = {
      leadId: undefined, // omitted for MVP or implement picker later
      vehicleId: undefined,
      billingName: formData.get("billingName") as string,
      billingEmail: (formData.get("billingEmail") as string) || undefined,
      billingPhone: (formData.get("billingPhone") as string) || undefined,
      billingAddress: (formData.get("billingAddress") as string) || undefined,
      billingAbn: (formData.get("billingAbn") as string) || undefined,
      dueDate: (formData.get("dueDate") as string) || undefined,
      notes: (formData.get("notes") as string) || undefined,
      paymentTerms: (formData.get("paymentTerms") as string) || undefined,
      footerNote: (formData.get("footerNote") as string) || undefined,
      invoiceDiscountCents,
      items: parsedItems.map((item, idx) => ({
        description: item.description,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        discountCents: item.discountCents,
        sortOrder: idx,
      })),
    };

    startTransition(async () => {
      const res = isEditing
        ? await updateInvoiceDraft(initialData.invoice.id, payload)
        : await createInvoiceDraft(payload);
        
      if (res.status === "error") {
        toast.error(res.message);
      } else {
        toast.success(res.message);
        router.push(`/admin/invoices/${res.id}`);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-[1fr_360px] items-start">
      <div className="space-y-6">
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Billing Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="billingName">Customer Name *</Label>
              <Input id="billingName" name="billingName" required defaultValue={initialData?.invoice.billingName} />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="billingEmail">Email</Label>
                <Input id="billingEmail" name="billingEmail" type="email" defaultValue={initialData?.invoice.billingEmail ?? ""} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="billingPhone">Phone</Label>
                <Input id="billingPhone" name="billingPhone" type="tel" defaultValue={initialData?.invoice.billingPhone ?? ""} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="billingAddress">Address</Label>
              <Textarea id="billingAddress" name="billingAddress" rows={2} defaultValue={initialData?.invoice.billingAddress ?? ""} />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="billingAbn">ABN</Label>
                <Input id="billingAbn" name="billingAbn" defaultValue={initialData?.invoice.billingAbn ?? ""} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input id="dueDate" name="dueDate" type="date" defaultValue={initialData?.invoice.dueDate ?? ""} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Line Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              {items.map((item, index) => (
                <div key={item.id} className="flex flex-col sm:flex-row gap-3 items-start border p-4 rounded-xl relative group">
                  <div className="flex-1 w-full grid gap-2">
                    <Label>Description *</Label>
                    <Input 
                      required 
                      value={item.description} 
                      onChange={e => {
                        const newItems = [...items];
                        newItems[index].description = e.target.value;
                        setItems(newItems);
                      }}
                    />
                  </div>
                  <div className="w-24 shrink-0 grid gap-2">
                    <Label>Qty *</Label>
                    <Input 
                      type="number" 
                      min="1" 
                      required 
                      value={item.quantity} 
                      onChange={e => {
                        const newItems = [...items];
                        newItems[index].quantity = parseInt(e.target.value) || 1;
                        setItems(newItems);
                      }}
                    />
                  </div>
                  <div className="w-32 shrink-0 grid gap-2">
                    <Label>Unit Price *</Label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      min="0" 
                      required 
                      value={item.unitPriceStr} 
                      onChange={e => {
                        const newItems = [...items];
                        newItems[index].unitPriceStr = e.target.value;
                        setItems(newItems);
                      }}
                    />
                  </div>
                  <div className="w-28 shrink-0 grid gap-2">
                    <Label>Discount</Label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      min="0" 
                      value={item.discountStr} 
                      onChange={e => {
                        const newItems = [...items];
                        newItems[index].discountStr = e.target.value;
                        setItems(newItems);
                      }}
                    />
                  </div>
                  {items.length > 1 && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="text-danger hover:text-danger hover:bg-danger/10 mt-6 shrink-0"
                      onClick={() => setItems(items.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            
            <Button 
              type="button" 
              variant="outline" 
              className="w-full border-dashed"
              onClick={() => setItems([...items, { id: crypto.randomUUID(), description: "", quantity: 1, unitPriceStr: "0.00", discountStr: "0.00" }])}
            >
              <Plus className="h-4 w-4 mr-2" /> Add Item
            </Button>
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Notes & Terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="notes">Internal Notes (Not printed)</Label>
              <Textarea id="notes" name="notes" rows={2} defaultValue={initialData?.invoice.notes ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="paymentTerms">Payment Terms</Label>
              <Textarea id="paymentTerms" name="paymentTerms" rows={3} defaultValue={initialData?.invoice.paymentTerms ?? invoiceSettings.paymentTerms} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="footerNote">Footer Note</Label>
              <Textarea id="footerNote" name="footerNote" rows={2} defaultValue={initialData?.invoice.footerNote ?? invoiceSettings.footerNote} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Column: Totals Sticky Panel */}
      <div className="sticky top-24">
        <Card variant="elevated" className="border-border">
          <CardHeader className="bg-muted/30 border-b border-border/50">
            <CardTitle>Invoice Totals</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums font-medium">{formatCurrency(totals.subtotalCents)}</span>
            </div>
            
            {totals.lineDiscountsCents > 0 && (
              <div className="flex justify-between text-sm text-success">
                <span>Line Discounts</span>
                <span className="tabular-nums font-medium">-{formatCurrency(totals.lineDiscountsCents)}</span>
              </div>
            )}
            
            <div className="grid gap-2 pt-2 border-t border-border/50">
              <Label>Additional Discount</Label>
              <Input 
                type="number" 
                step="0.01" 
                min="0"
                value={invoiceDiscountStr}
                onChange={e => setInvoiceDiscountStr(e.target.value)}
              />
            </div>
            
            {invoiceSettings.gstEnabled && (
              <div className="flex justify-between text-sm pt-2">
                <span className="text-muted-foreground">GST ({invoiceSettings.gstRate}%)</span>
                <span className="tabular-nums font-medium">{formatCurrency(totals.gstCents)}</span>
              </div>
            )}
            
            <div className="flex justify-between text-lg font-bold pt-4 border-t border-border/50">
              <span>Total due</span>
              <span className="tabular-nums">{formatCurrency(totals.totalIncGstCents)}</span>
            </div>
            
            <div className="text-[10px] text-muted-foreground text-center">
              {invoiceSettings.pricesIncludeGst ? "Prices include GST where applicable" : "Prices exclude GST"}
            </div>

            <Button type="submit" size="cta" disabled={isPending} className="w-full mt-4">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              {isEditing ? "Save Draft" : "Create Draft"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
