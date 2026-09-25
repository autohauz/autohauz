"use server";

import { revalidatePath } from "next/cache";
import { updateTags } from "@/lib/cache";
import { requirePermission } from "@/lib/security/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { faqSchema } from "@/lib/validation/content";

function refresh() {
  updateTags("faqs");
  updateTags("public");
  revalidatePath("/admin/faqs");
}

export async function saveFaq(_prev: unknown, formData: FormData) {
  await requirePermission("content.write");
  const raw = Object.fromEntries(formData.entries());
  const parsed = faqSchema.safeParse({ ...raw, isPublished: raw.isPublished === "on" });
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  const d = parsed.data;
  const supabase = createAdminClient();
  const row = { category: d.category, question: d.question, answer: d.answer, sort_order: d.sortOrder, is_published: d.isPublished };
  const { error } = d.id
    ? await supabase.from("faqs").update(row).eq("id", d.id)
    : await supabase.from("faqs").insert(row);
  if (error) return { error: error.message };
  refresh();
  return { ok: true };
}

export async function deleteFaq(id: string) {
  await requirePermission("content.delete");
  const supabase = createAdminClient();
  await supabase.from("faqs").delete().eq("id", id);
  refresh();
  return { ok: true };
}
