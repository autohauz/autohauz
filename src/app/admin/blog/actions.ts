"use server";

import { updateTags } from "@/lib/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminRole } from "@/lib/security/auth";
import { slugify } from "@/lib/utils";
import type { BlogStatus } from "@/lib/domain";

// Validation helper (simple check for required fields)
function validateArticle(data: FormData) {
  const title = data.get("title")?.toString().trim();
  const slug = data.get("slug")?.toString().trim() || slugify(title || "");
  const body = data.get("body")?.toString().trim();
  const categoryId = data.get("categoryId")?.toString() || null;
  const status = (data.get("status")?.toString() || "draft") as BlogStatus;

  if (!title || !slug || !body) {
    throw new Error("Title, slug, and body are required.");
  }

  return {
    title,
    slug,
    body,
    excerpt: data.get("excerpt")?.toString().trim() || null,
    featured_image_url: data.get("featuredImageUrl")?.toString() || null,
    featured_image_alt: data.get("featuredImageAlt")?.toString().trim() || null,
    social_image_url: data.get("socialImageUrl")?.toString() || null,
    canonical_url: data.get("canonicalUrl")?.toString().trim() || null,
    category_id: categoryId,
    status,
    meta_title: data.get("metaTitle")?.toString().trim() || null,
    meta_description: data.get("metaDescription")?.toString().trim() || null,
    reading_time_minutes: Math.max(1, Math.ceil(body.split(/\s+/).length / 200)),
    published_at: status === "published" ? new Date().toISOString() : null,
    scheduled_at: status === "scheduled" && data.get("scheduledAt") ? new Date(data.get("scheduledAt")!.toString()).toISOString() : null,
  };
}

export async function createBlogArticle(formData: FormData) {
  const user = await requireAdminRole(["content", "owner", "admin"]);
  const supabase = createAdminClient();

  let articleId: string;
  try {
    const payload = validateArticle(formData);
    
    // Auto-assign author if not provided
    const authorId = user.id;
    const authorName = formData.get("authorName")?.toString().trim() || null;

    const { data, error } = await supabase
      .from("blog_articles")
      .insert({
        ...payload,
        author_id: authorId,
        author_name: authorName,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    articleId = data.id;

  } catch (error: any) {
    return { error: error.message || "Failed to create article" };
  }

  updateTags("blog_articles");
  redirect(`/admin/blog/${articleId}`);
}

export async function updateBlogArticle(id: string, formData: FormData) {
  await requireAdminRole(["content", "owner", "admin"]);
  const supabase = createAdminClient();

  try {
    const payload = validateArticle(formData);
    const authorName = formData.get("authorName")?.toString().trim() || null;

    // Preserve original published_at if already published
    if (payload.status === "published") {
      delete (payload as any).published_at; // we don't overwrite if it was already published, unless we want to "re-publish"
      // we can fetch the existing to check, but for simplicity, we just update updated_at
    }

    const { error } = await supabase
      .from("blog_articles")
      .update({
        ...payload,
        author_name: authorName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) throw new Error(error.message);
  } catch (error: any) {
    return { error: error.message || "Failed to update article" };
  }

  updateTags("blog_articles");
  updateTags("blog_article_slug"); // specific article cache tag
  return { success: true };
}

export async function deleteBlogArticle(id: string) {
  await requireAdminRole(["owner", "admin"]);
  const supabase = createAdminClient();

  const { error } = await supabase.from("blog_articles").delete().eq("id", id);
  if (error) {
    return { error: error.message || "Failed to delete article" };
  }

  updateTags("blog_articles");
  redirect("/admin/blog");
}

export async function createBlogCategory(formData: FormData) {
  await requireAdminRole(["content", "owner", "admin"]);
  const supabase = createAdminClient();
  const name = formData.get("name")?.toString().trim();
  const slug = formData.get("slug")?.toString().trim() || slugify(name || "");

  if (!name || !slug) return { error: "Name and slug are required" };

  const { error } = await supabase.from("blog_categories").insert({ name, slug });
  if (error) return { error: error.message };
  updateTags("blog_categories");
  return { success: true };
}

export async function updateBlogCategory(id: string, formData: FormData) {
  await requireAdminRole(["content", "owner", "admin"]);
  const supabase = createAdminClient();
  const name = formData.get("name")?.toString().trim();
  const slug = formData.get("slug")?.toString().trim();

  if (!name || !slug) return { error: "Name and slug are required" };

  const { error } = await supabase.from("blog_categories").update({ name, slug }).eq("id", id);
  if (error) return { error: error.message };
  updateTags("blog_categories");
  return { success: true };
}

export async function deleteBlogCategory(id: string) {
  await requireAdminRole(["owner", "admin"]);
  const supabase = createAdminClient();

  const { error } = await supabase.from("blog_categories").delete().eq("id", id);
  if (error) return { error: error.message };
  updateTags("blog_categories");
  return { success: true };
}
