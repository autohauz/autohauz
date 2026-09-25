"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/security/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateTags } from "@/lib/cache";
import { leadStatusUpdateSchema, leadNoteSchema } from "@/lib/validation/admin";

type Result = { ok?: boolean; error?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLOSED = new Set(["won", "lost", "spam"]);

async function logEvent(leadId: string, actorId: string, event: string, data: Record<string, unknown> = {}) {
  const { error } = await createAdminClient().from("lead_events").insert({ lead_id: leadId, actor_id: actorId, event, data });
  if (error) console.error(`[leads] event "${event}" not recorded:`, error.message);
}

function refresh(leadId?: string) {
  revalidatePath("/admin/leads");
  if (leadId) revalidatePath(`/admin/leads/${leadId}`);
  updateTags("leads"); // dashboard KPIs
}

function failed(context: string, message: string): Result {
  console.error(`[leads] ${context}:`, message);
  return { error: `Could not ${context}. Please try again.` };
}

/**
 * Moves a lead through the pipeline. Timestamps follow the lead's real
 * history: the first contact time is kept once set (response-time metrics),
 * closing sets closed_at, and reopening clears it and any stale loss reason.
 */
export async function updateLeadStatus(input: { leadId: string; status: string; lossReason?: string }): Promise<Result> {
  const user = await requirePermission("leads.write");
  const parsed = leadStatusUpdateSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { leadId, status, lossReason } = parsed.data;

  const supabase = createAdminClient();
  const { data: current, error: readError } = await supabase
    .from("leads")
    .select("status, first_contacted_at")
    .eq("id", leadId)
    .maybeSingle();
  if (readError) return failed("load the lead", readError.message);
  if (!current) return { error: "Lead not found" };
  if (current.status === status) return { ok: true };

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status,
    updated_at: now,
    loss_reason: status === "lost" ? lossReason : null,
    closed_at: CLOSED.has(status) ? now : null,
  };
  if (status !== "new" && !current.first_contacted_at) patch.first_contacted_at = now;

  const { error } = await supabase.from("leads").update(patch).eq("id", leadId);
  if (error) return failed("update the lead", error.message);
  await logEvent(leadId, user.id, "status_changed", { from: current.status, status, lossReason });
  refresh(leadId);
  return { ok: true };
}

export async function addLeadNote(input: { leadId: string; note: string }): Promise<Result> {
  const user = await requirePermission("leads.write");
  const parsed = leadNoteSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid note" };
  await logEvent(parsed.data.leadId, user.id, "note", { note: parsed.data.note });
  revalidatePath(`/admin/leads/${parsed.data.leadId}`);
  return { ok: true };
}

export async function assignLeadToMe(leadId: string): Promise<Result> {
  const user = await requirePermission("leads.write");
  if (!UUID.test(leadId)) return { error: "Lead not found" };
  const { error } = await createAdminClient().from("leads").update({ assignee_id: user.id }).eq("id", leadId);
  if (error) return failed("assign the lead", error.message);
  await logEvent(leadId, user.id, "assigned", { assignee_id: user.id });
  refresh(leadId);
  return { ok: true };
}

/** Quarantines a lead as spam (it leaves the pipeline and the win/loss figures). */
export async function markLeadSpam(leadId: string): Promise<Result> {
  return updateLeadStatus({ leadId, status: "spam" });
}

/**
 * Permanently deletes a lead and its timeline (managers and above). The audit
 * entry records that it happened, not the person's details.
 */
export async function deleteLead(leadId: string): Promise<Result> {
  const user = await requirePermission("leads.delete");
  if (!UUID.test(leadId)) return { error: "Lead not found" };
  const supabase = createAdminClient();

  const { data: lead } = await supabase.from("leads").select("type, status, created_at").eq("id", leadId).maybeSingle();
  if (!lead) return { error: "Lead not found" };

  const { error } = await supabase.from("leads").delete().eq("id", leadId);
  if (error) return failed("delete the lead", error.message);

  const { error: auditError } = await supabase.from("activity_logs").insert({
    user_id: user.id,
    action: "lead_deleted",
    entity_type: "lead",
    entity_id: leadId,
    diff: { type: lead.type, status: lead.status, createdAt: lead.created_at },
  });
  if (auditError) console.error("[leads] audit write failed:", auditError.message);

  refresh();
  redirect("/admin/leads");
}
