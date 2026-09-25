"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Download, Mail, Pencil, Printer, Send, XCircle } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Dialog as DialogRoot, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { emailInvoice, issueInvoice, recordPayment, voidInvoice, type ActionState } from "../actions";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/lib/validation/invoice";
import { formatAud, sydneyToday } from "@/lib/invoices/document";
import type { InvoiceStatus } from "@/lib/domain";

interface InvoiceActionsProps {
  id: string;
  status: InvoiceStatus;
  balanceDueCents: number;
  billingEmail: string | null;
  canVoid: boolean;
}

type OpenDialog = "issue" | "void" | "payment" | null;

export function InvoiceActions({ id, status, balanceDueCents, billingEmail, canVoid }: InvoiceActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const [voidReason, setVoidReason] = useState("");

  const run = (action: () => Promise<ActionState>, after?: () => void) =>
    startTransition(async () => {
      const res = await action();
      if (res.status === "error") {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      after?.();
      setDialog(null);
      router.refresh();
    });

  const open = status === "issued" || status === "partially_paid";

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm print:hidden">
      {status === "draft" && (
        <>
          <ButtonLink href={`/admin/invoices/${id}/edit`} variant="outline">
            <Pencil className="mr-2 size-4" aria-hidden="true" /> Edit draft
          </ButtonLink>
          <Button onClick={() => setDialog("issue")} disabled={isPending}>
            <Send className="mr-2 size-4" aria-hidden="true" /> Issue invoice
          </Button>
        </>
      )}

      {open && (
        <Button onClick={() => setDialog("payment")} disabled={isPending}>
          <CheckCircle2 className="mr-2 size-4" aria-hidden="true" /> Record payment
        </Button>
      )}

      {status !== "draft" && (
        <>
          <ButtonLink href={`/api/v1/invoices/${id}/pdf?download=1`} variant="outline" prefetch={false}>
            <Download className="mr-2 size-4" aria-hidden="true" /> Download PDF
          </ButtonLink>
          {status !== "void" && (
            <Button
              variant="outline"
              disabled={isPending || !billingEmail}
              title={billingEmail ? undefined : "Add a billing email to the invoice to send it"}
              onClick={() => run(() => emailInvoice(id))}
            >
              <Mail className="mr-2 size-4" aria-hidden="true" /> Email to customer
            </Button>
          )}
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 size-4" aria-hidden="true" /> Print
          </Button>
        </>
      )}

      {canVoid && (status === "draft" || open) && (
        <Button onClick={() => setDialog("void")} disabled={isPending} variant="destructive" className="ml-auto">
          <XCircle className="mr-2 size-4" aria-hidden="true" /> Void
        </Button>
      )}

      <ConfirmDialog
        open={dialog === "issue"}
        onOpenChange={(o) => setDialog(o ? "issue" : null)}
        title="Issue this invoice?"
        description="It will be given the next invoice number and locked. Issued invoices cannot be edited or deleted — only voided."
        confirmLabel="Issue invoice"
        pending={isPending}
        onConfirm={() => run(() => issueInvoice(id))}
      />

      <ConfirmDialog
        open={dialog === "void"}
        onOpenChange={(o) => setDialog(o ? "void" : null)}
        title="Void this invoice?"
        description="The invoice stays on record with its number, marked void. This cannot be undone."
        confirmLabel="Void invoice"
        destructive
        pending={isPending}
        onConfirm={() => run(() => voidInvoice(id, voidReason.trim() || undefined), () => setVoidReason(""))}
      >
        <div className="grid gap-2">
          <Label htmlFor="void-reason">Reason (kept in the invoice history)</Label>
          <Textarea id="void-reason" rows={2} maxLength={500} value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
        </div>
      </ConfirmDialog>

      <PaymentDialog
        open={dialog === "payment"}
        onOpenChange={(o) => setDialog(o ? "payment" : null)}
        balanceDueCents={balanceDueCents}
        pending={isPending}
        onSubmit={(payload) => run(() => recordPayment(id, payload))}
      />
    </div>
  );
}

function PaymentDialog({
  open,
  onOpenChange,
  balanceDueCents,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  balanceDueCents: number;
  pending: boolean;
  onSubmit: (payload: Parameters<typeof recordPayment>[1]) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const dollars = Number.parseFloat(String(form.get("amount") ?? ""));
    const amountCents = Number.isFinite(dollars) ? Math.round(dollars * 100) : 0;
    if (amountCents <= 0) return setError("Enter an amount greater than zero.");
    if (amountCents > balanceDueCents) return setError(`The balance due is ${formatAud(balanceDueCents)}.`);
    setError(null);
    onSubmit({
      amountCents,
      paymentDate: String(form.get("paymentDate") ?? ""),
      paymentMethod: String(form.get("paymentMethod") ?? "") as (typeof PAYMENT_METHODS)[number],
      referenceNumber: String(form.get("referenceNumber") ?? "") || null,
      notes: String(form.get("notes") ?? "") || null,
    });
  };

  return (
    <DialogRoot open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record a payment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
          <p className="text-sm text-muted-foreground">
            Balance due: <strong className="text-foreground">{formatAud(balanceDueCents)}</strong>
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="payment-amount">Amount ($) *</Label>
              <Input
                id="payment-amount"
                name="amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                required
                defaultValue={(balanceDueCents / 100).toFixed(2)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "payment-error" : undefined}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="payment-date">Date received *</Label>
              <Input id="payment-date" name="paymentDate" type="date" required defaultValue={sydneyToday()} max={sydneyToday()} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="payment-method">Method *</Label>
            <Select id="payment-method" name="paymentMethod" required defaultValue="bank_transfer">
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABELS[m]}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="payment-ref">Reference</Label>
            <Input id="payment-ref" name="referenceNumber" maxLength={100} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="payment-notes">Notes</Label>
            <Textarea id="payment-notes" name="notes" rows={2} maxLength={1000} />
          </div>
          {error ? (
            <p id="payment-error" role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending} aria-busy={pending}>
              Record payment
            </Button>
          </div>
        </form>
      </DialogContent>
    </DialogRoot>
  );
}
