import type { InvoiceStatus } from "@/lib/domain";

export const VALID_INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ["issued", "void"],
  issued: ["partially_paid", "paid", "void"],
  partially_paid: ["paid", "void"],
  paid: [],
  void: [],
};

export function canTransitionInvoice(current: InvoiceStatus, next: InvoiceStatus): boolean {
  if (current === next) return true;
  return VALID_INVOICE_TRANSITIONS[current]?.includes(next) ?? false;
}

export function assertValidTransition(current: InvoiceStatus, next: InvoiceStatus): void {
  if (!canTransitionInvoice(current, next)) {
    throw new Error(`Invalid invoice state transition from ${current} to ${next}`);
  }
}
