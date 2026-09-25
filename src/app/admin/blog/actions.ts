"use server";

import { updateTags } from "@/lib/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/security/auth";
import { blogArticleFromForm, blogArticleSchema, blogCategorySchema, type BlogArticleInput } from "@/lib/validation/blog";
import { sanitizeArticleHtml, wordCount } from "@/lib/content/sanitize";
import { articleCanonicalPath } from "@/lib/seo/blog";
import { slugify } from "@/lib/utils";

export type BlogActionResult = { ok: true; id?: string } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Supabase = ReturnType<typeof createAdminClient>;

function fail(context: string, error: { code?: string; message: string }): BlogActionResult {
  if (error.code === "23505") return { ok: false, error: "That slug is already used by another article." };
  console.error(`[blog] ${context}:`, error.message);
  return { ok: false, error: `Could not ${context}. Please try again.` };
}

function parseArticle(form: FormData): { ok: true; data: BlogArticleInput } | { ok: false; error: string } {
  const parsed = blogArticleSchema({ supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL }).safeParse(blogArticleFromForm(form));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid article" };
  return { ok: true, data: parsed.data };
}

/**
 * Columns written for an article. The body is sanitised HERE, on the server,
 * so the database never holds unsafe HTML. The canonical is normalised to a
 * same-site path (an off-site canonical would de-index the post).
 */
function articleColumns(d: BlogArticleInput, publishedAt: string | null) {
  const body = sanitizeArticleHtml(d.body);
  return {
    title: d.title,
    slug: d.slug,
    body,
    excerpt: d.excerpt,
    featured_image_url: d.featuredImageUrl,
    featured_image_alt: d.featuredImageAlt,
    canonical_url: d.canonicalUrl ? articleCanonicalPath({ slug: d.slug, canonicalUrl: d.canonicalUrl }) : null,
    category_id: d.categoryId,
    status: d.status,
    meta_title: d.metaTitle,
    meta_description: d.metaDescription,
    author_name: d.authorName,
    reading_time_minutes: Math.max(1, Math.ceil(wordCount(body) / 200)),
    // First publication date is kept on later edits and republishing.
    published_at: d.status === "published" ? publishedAt ?? new Date().toISOString() : publishedAt,
    scheduled_at: d.status === "scheduled" && d.scheduledAt ? new Date(d.scheduledAt).toISOString() : null,
  };
}

async function audit(supabase: Supabase, actorId: string, action: string, id: string, diff: Record<string, unknown> = {}) {
  const { error } = await supabase
    .from("activity_logs")
    .insert({ user_id: actorId, action, entity_type: "blog_article", entity_id: id, diff });
  if (error) console.error(`[blog] audit "${action}" failed:`, error.message);
}

export async function createBlogArticle(formData: FormData): Promise<BlogActionResult> {
  const user = await requirePermission("content.write");
  const parsed = parseArticle(formData);
  if (!parsed.ok) return parsed;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("blog_articles")
    .insert({ ...articleColumns(parsed.data, null), author_id: user.id })
    .select("id")
    .single();
  if (error || !data) return fail("create the article", error ?? { message: "no row returned" });

  await audit(supabase, user.id, "blog_article_created", data.id, { status: parsed.data.status });
  updateTags("blog_articles");
  return { ok: true, id: data.id };
}

export async function updateBlogArticle(id: string, formData: FormData): Promise<BlogActionResult> {
  const user = await requirePermission("content.write");
  if (!UUID.test(id)) return { ok: false, error: "Article not found" };
  const parsed = parseArticle(formData);
  if (!parsed.ok) return parsed;

  const supabase = createAdminClient();
  const { data: existing, error: readError } = await supabase
    .from("blog_articles")
    .select("published_at, status")
    .eq("id", id)
    .maybeSingle();
  if (readError) return fail("load the article", readError);
  if (!existing) return { ok: false, error: "Article not found" };

  const { error } = await supabase
    .from("blog_articles")
    .update({ ...articleColumns(parsed.data, existing.published_at), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return fail("save the article", error);

  if (existing.status !== parsed.data.status) {
    await audit(supabase, user.id, "blog_article_status_changed", id, { from: existing.status, to: parsed.data.status });
  }
  updateTags("blog_articles");
  return { ok: true, id };
}

export async function deleteBlogArticle(id: string): Promise<BlogActionResult> {
  const user = await requirePermission("content.delete");
  if (!UUID.test(id)) return { ok: false, error: "Article not found" };
  const supabase = createAdminClient();

  const { data: existing } = await supabase.from("blog_articles").select("title, slug").eq("id", id).maybeSingle();
  const { error } = await supabase.from("blog_articles").delete().eq("id", id);
  if (error) return fail("delete the article", error);

  await audit(supabase, user.id, "blog_article_deleted", id, existing ?? {});
  updateTags("blog_articles");
  return { ok: true };
}

export async function createBlogCategory(formData: FormData): Promise<BlogActionResult> {
  await requirePermission("content.write");
  const parsed = blogCategorySchema.safeParse({
    name: formData.get("name")?.toString() ?? "",
    slug: formData.get("slug")?.toString() || slugify(formData.get("name")?.toString() ?? ""),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid category" };

  const { error } = await createAdminClient().from("blog_categories").insert(parsed.data);
  if (error) return error.code === "23505" ? { ok: false, error: "That category already exists." } : fail("create the category", error);
  updateTags("blog_categories");
  return { ok: true };
}

export async function updateBlogCategory(id: string, formData: FormData): Promise<BlogActionResult> {
  await requirePermission("content.write");
  if (!UUID.test(id)) return { ok: false, error: "Category not found" };
  const parsed = blogCategorySchema.safeParse({
    name: formData.get("name")?.toString() ?? "",
    slug: formData.get("slug")?.toString() ?? "",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid category" };

  const { error } = await createAdminClient().from("blog_categories").update(parsed.data).eq("id", id);
  if (error) return error.code === "23505" ? { ok: false, error: "That slug is already used." } : fail("save the category", error);
  updateTags("blog_categories", "blog_articles");
  return { ok: true };
}

export async function deleteBlogCategory(id: string): Promise<BlogActionResult> {
  await requirePermission("content.delete");
  if (!UUID.test(id)) return { ok: false, error: "Category not found" };
  const { error } = await createAdminClient().from("blog_categories").delete().eq("id", id);
  if (error) return fail("delete the category", error);
  updateTags("blog_categories", "blog_articles");
  return { ok: true };
}
