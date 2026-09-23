"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/security/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { leadStatusUpdateSchema, leadNoteSchema } from "@/lib/validation/admin";

async function logEvent(leadId: string, actorId: string, event: string, data: Record<string, unknown> = {}) {
  const supabase = createAdminClient();
  await supabase.from("lead_events").insert({ lead_id: leadId, actor_id: actorId, event, data });
}

export async function updateLeadStatus(input: { leadId: string; status: string; lossReason?: string }) {
  const user = await requireAdmin();
  const parsed = leadStatusUpdateSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { leadId, status, lossReason } = parsed.data;

  const supabase = createAdminClient();
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "lost") patch.loss_reason = lossReason;
  if (status === "contacted") patch.first_contacted_at = new Date().toISOString();
  if (["won", "lost"].includes(status)) patch.closed_at = new Date().toISOString();

  const { error } = await supabase.from("leads").update(patch).eq("id", leadId);
  if (error) return { error: error.message };
  await logEvent(leadId, user.id, "status_changed", { status, lossReason });
  revalidatePath("/admin/leads");
  revalidatePath(`/admin/leads/${leadId}`);
  return { ok: true };
}

export async function addLeadNote(input: { leadId: string; note: string }) {
  const user = await requireAdmin();
  const parsed = leadNoteSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid note" };
  await logEvent(parsed.data.leadId, user.id, "note", { note: parsed.data.note });
  revalidatePath(`/admin/leads/${parsed.data.leadId}`);
  return { ok: true };
}

export async function assignLeadToMe(leadId: string) {
  const user = await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.from("leads").update({ assignee_id: user.id }).eq("id", leadId);
  if (error) return { error: error.message };
  await logEvent(leadId, user.id, "assigned", { assignee_id: user.id });
  revalidatePath(`/admin/leads/${leadId}`);
  return { ok: true };
}

export async function markLeadSpam(leadId: string) {
  const user = await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.from("leads").update({ status: "lost" }).eq("id", leadId);
  if (error) return { error: error.message };
  await logEvent(leadId, user.id, "status_changed", { status: "lost", reason: "spam" });
  revalidatePath("/admin/leads");
  return { ok: true };
}

export async function deleteLead(leadId: string): Promise<{ error?: string; ok?: boolean }> {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.from("leads").delete().eq("id", leadId);
  if (error) return { error: error.message };
  
  revalidatePath("/admin/leads");
  redirect("/admin/leads");
}
