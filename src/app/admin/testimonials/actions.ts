"use server";

import { revalidatePath } from "next/cache";
import { updateTags } from "@/lib/cache";
import { requirePermission } from "@/lib/security/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { testimonialSchema } from "@/lib/validation/content";


function refresh() {
  updateTags("testimonials");
  updateTags("public");
  revalidatePath("/admin/testimonials");
}

export async function saveTestimonial(_prev: unknown, formData: FormData) {
  await requirePermission("content.write");
  const raw = Object.fromEntries(formData.entries());
  const parsed = testimonialSchema.safeParse({ ...raw, isApproved: raw.isApproved === "on" });
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  const d = parsed.data;
  const supabase = createAdminClient();
  const row = {
    customer_name: d.customerName,
    vehicle_id: d.vehicleId || null,
    rating: d.rating,
    quote: d.quote,
    source: d.source,
    review_date: d.reviewDate || null,
    is_approved: d.isApproved,
    sort_order: d.sortOrder,
  };
  const { error } = d.id
    ? await supabase.from("testimonials").update(row).eq("id", d.id)
    : await supabase.from("testimonials").insert(row);
  if (error) return { error: error.message };
  refresh();
  return { ok: true };
}

export async function toggleTestimonialApproved(id: string, approved: boolean) {
  await requirePermission("content.write");
  const supabase = createAdminClient();
  await supabase.from("testimonials").update({ is_approved: approved }).eq("id", id);
  refresh();
  return { ok: true };
}

export async function deleteTestimonial(id: string) {
  await requirePermission("content.delete");
  const supabase = createAdminClient();
  await supabase.from("testimonials").delete().eq("id", id);
  refresh();
  return { ok: true };
}
