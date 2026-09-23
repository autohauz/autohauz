import type { InvoiceStatus } from "@/lib/domain";

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus | "overdue", string> = {
  draft: "Draft",
  issued: "Issued",
  partially_paid: "Partially Paid",
  paid: "Paid",
  void: "Void",
  overdue: "Overdue",
};

export const INVOICE_STATUS_STYLES: Record<InvoiceStatus | "overdue", string> = {
  draft: "bg-muted text-muted-foreground border border-border",
  issued: "bg-info-soft text-info border border-info/20",
  partially_paid: "bg-warning-soft text-warning border border-warning/20",
  paid: "bg-success-soft text-success border border-success/20",
  void: "bg-muted text-muted-foreground border border-border opacity-60",
  overdue: "bg-danger-soft text-danger border border-danger/20",
};
