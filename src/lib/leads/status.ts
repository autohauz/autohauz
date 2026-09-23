import type { LeadStatus, LeadType } from "@/lib/domain";

/** Lead pipeline config (SRS §14.4). */
export const LEAD_STATUS_ORDER: LeadStatus[] = [
  "new", "contacted", "qualified", "inspection_scheduled", "negotiation", "won", "lost",
];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  inspection_scheduled: "Inspection Scheduled",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
  spam: "Spam",
};

export const LEAD_STATUS_STYLES: Record<LeadStatus, string> = {
  new: "bg-primary/15 text-primary",
  contacted: "bg-info/15 text-info",
  qualified: "bg-info/15 text-info",
  inspection_scheduled: "bg-warning/15 text-warning",
  negotiation: "bg-warning/15 text-warning",
  won: "bg-success/15 text-success",
  lost: "bg-muted text-muted-foreground",
  spam: "bg-danger/15 text-danger",
};

export const LEAD_TYPE_LABELS: Record<LeadType, string> = {
  vehicle_enquiry: "Vehicle enquiry",
  inspection: "Inspection",
  finance: "Finance",
  trade_in: "Trade-in",
  sell: "Sell your car",
  callback: "Callback",
  general: "General",
};

export const LOSS_REASONS = ["price", "sold_elsewhere", "finance_declined", "unresponsive", "other"] as const;
export const LOSS_REASON_LABELS: Record<string, string> = {
  price: "Price",
  sold_elsewhere: "Sold elsewhere",
  finance_declined: "Finance declined",
  unresponsive: "Unresponsive",
  other: "Other",
};
