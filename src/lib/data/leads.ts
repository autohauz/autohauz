import "server-only";
import { requirePermission } from "@/lib/security/auth";
/* eslint-disable @typescript-eslint/no-explicit-any --
   Untyped Supabase client: lead rows surface as `any` and are shaped into typed
   domain projections before leaving this module. */
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeSearchTerm } from "@/lib/data/search";
import type { Lead, LeadEvent, LeadStatus, LeadType } from "@/lib/domain";

/**
 * Admin lead pipeline reads (SRS §15.3). Called after page-level requireAdmin,
 * so the admin (service-role) client is used.
 */

type RawRow = Record<string, any>;

function toLead(r: RawRow): Lead {
  return {
    id: r.id,
    type: r.type,
    status: r.status,
    lossReason: r.loss_reason ?? null,
    name: r.name,
    phone: r.phone,
    email: r.email ?? null,
    message: r.message ?? null,
    vehicleId: r.vehicle_id ?? null,
    payload: r.payload ?? {},
    sourceUrl: r.source_url ?? null,
    utm: r.utm ?? {},
    device: r.device ?? null,
    assigneeId: r.assignee_id ?? null,
    firstContactedAt: r.first_contacted_at ?? null,
    closedAt: r.closed_at ?? null,
    duplicateOf: r.duplicate_of ?? null,
    createdAt: r.created_at,
  };
}

const LEAD_SELECT = `
  id, type, status, loss_reason, name, phone, email, message, vehicle_id, payload,
  source_url, utm, device, assignee_id, first_contacted_at, closed_at, duplicate_of, created_at
`;

export async function getLeadList(filters?: {
  status?: LeadStatus;
  type?: LeadType;
  assigneeId?: string;
  q?: string;
}): Promise<Lead[]> {
  await requirePermission("leads.view");
  const supabase = createAdminClient();
  let q = supabase
    .from("leads")
    .select(LEAD_SELECT)
    .neq("status", "spam")
    .order("created_at", { ascending: false })
    .limit(500);
  if (filters?.status) q = q.eq("status", filters.status);
  if (filters?.type) q = q.eq("type", filters.type);
  if (filters?.assigneeId) q = q.eq("assignee_id", filters.assigneeId);
  const term = sanitizeSearchTerm(filters?.q);
  if (term) q = q.or(`name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`);
  const { data } = await q;
  return ((data ?? []) as RawRow[]).map(toLead);
}

export async function getSpamLeads(): Promise<Lead[]> {
  await requirePermission("leads.view");
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("leads")
    .select(LEAD_SELECT)
    .eq("status", "spam")
    .order("created_at", { ascending: false })
    .limit(200);
  return ((data ?? []) as RawRow[]).map(toLead);
}

export async function getLeadDetail(
  id: string,
): Promise<{ lead: Lead; events: LeadEvent[] } | null> {
  await requirePermission("leads.view");
  const supabase = createAdminClient();
  const { data: leadRow } = await supabase.from("leads").select(LEAD_SELECT).eq("id", id).maybeSingle();
  if (!leadRow) return null;
  const { data: eventRows } = await supabase
    .from("lead_events")
    .select("id, lead_id, actor_id, event, data, created_at")
    .eq("lead_id", id)
    .order("created_at", { ascending: true });
  const events: LeadEvent[] = ((eventRows ?? []) as RawRow[]).map((e) => ({
    id: e.id,
    leadId: e.lead_id,
    actorId: e.actor_id ?? null,
    event: e.event,
    data: e.data ?? {},
    createdAt: e.created_at,
  }));
  return { lead: toLead(leadRow as RawRow), events };
}
