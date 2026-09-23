"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send, CheckCircle2, XCircle, Printer, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { issueInvoice, voidInvoice } from "../actions";
import type { InvoiceStatus } from "@/lib/domain";

interface InvoiceActionsProps {
  id: string;
  status: InvoiceStatus;
}

export function InvoiceActions({ id, status }: InvoiceActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleIssue = () => {
    if (!confirm("Are you sure you want to issue this invoice? It will be locked for editing.")) return;
    startTransition(async () => {
      const res = await issueInvoice(id);
      if (res.status === "error") {
        toast.error(res.message);
      } else {
        toast.success(res.message);
        router.refresh();
      }
    });
  };

  const handleVoid = () => {
    if (!confirm("Are you sure you want to void this invoice? This cannot be undone.")) return;
    startTransition(async () => {
      const res = await voidInvoice(id);
      if (res.status === "error") {
        toast.error(res.message);
      } else {
        toast.success(res.message);
        router.refresh();
      }
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-wrap items-center gap-3 bg-card border border-border p-4 rounded-xl shadow-sm print:hidden">
      {status === "draft" && (
        <Button onClick={() => router.push(`/admin/invoices/${id}/edit`)} variant="outline">
          Edit Draft
        </Button>
      )}

      {status === "draft" && (
        <Button onClick={handleIssue} disabled={isPending} className="bg-success text-success-foreground hover:bg-success/90">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
          Issue Invoice
        </Button>
      )}

      {(status === "issued" || status === "partially_paid") && (
        <Button onClick={() => alert("Record Payment modal (to be implemented in UI)")} className="bg-primary text-primary-foreground">
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Record Payment
        </Button>
      )}

      {(status === "draft" || status === "issued" || status === "partially_paid") && (
        <Button onClick={handleVoid} disabled={isPending} variant="destructive" className="ml-auto">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
          Void
        </Button>
      )}

      {status !== "draft" && (
        <Button onClick={handlePrint} variant="outline" className={status === "void" || status === "paid" ? "ml-auto" : ""}>
          <Printer className="h-4 w-4 mr-2" />
          Print / PDF
        </Button>
      )}
    </div>
  );
}
