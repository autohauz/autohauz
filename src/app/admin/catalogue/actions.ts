"use server";

import { revalidatePath } from "next/cache";
import { updateTags } from "@/lib/cache";
import { requirePermission } from "@/lib/security/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

function slugify(str: string) {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const makeSchema = z.object({
  name: z.string().min(1).max(80),
  isPopular: z.coerce.boolean().optional(),
});

const modelSchema = z.object({
  makeId: z.string().uuid(),
  name: z.string().min(1).max(80),
});

export async function createMake(_prev: unknown, formData: FormData) {
  await requirePermission("catalogue.write");
  const parsed = makeSchema.safeParse({
    name: formData.get("name"),
    isPopular: formData.get("isPopular") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = createAdminClient();
  const slug = slugify(parsed.data.name);
  const { data, error } = await supabase.from("makes").insert({
    name: parsed.data.name,
    slug,
    is_popular: parsed.data.isPopular ?? false,
  }).select("id").single();

  if (error) {
    if (error.code === "23505") return { error: `"${parsed.data.name}" already exists.` };
    return { error: error.message };
  }

  revalidatePath("/admin/catalogue");
  updateTags("makes", "public");
  return { ok: true, id: data.id };
}

export async function deleteMake(_prev: unknown, formData: FormData) {
  await requirePermission("catalogue.write");
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing ID" };
  const supabase = createAdminClient();
  const { error } = await supabase.from("makes").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/catalogue");
  updateTags("makes", "public");
  return { ok: true };
}

export async function createModel(_prev: unknown, formData: FormData) {
  await requirePermission("catalogue.write");
  const parsed = modelSchema.safeParse({
    makeId: formData.get("makeId"),
    name: formData.get("name"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = createAdminClient();
  const slug = slugify(parsed.data.name);
  const { data, error } = await supabase.from("models").insert({
    make_id: parsed.data.makeId,
    name: parsed.data.name,
    slug,
  }).select("id").single();

  if (error) {
    if (error.code === "23505") return { error: `Model "${parsed.data.name}" already exists for this make.` };
    return { error: error.message };
  }

  revalidatePath("/admin/catalogue");
  updateTags("makes", "public");
  return { ok: true, id: data.id };
}

export async function deleteModel(_prev: unknown, formData: FormData) {
  await requirePermission("catalogue.write");
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing ID" };
  const supabase = createAdminClient();
  const { error } = await supabase.from("models").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/catalogue");
  updateTags("makes", "public");
  return { ok: true };
}
