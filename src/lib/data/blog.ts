import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireEnv } from "@/lib/config";
import { buildMediaUrl } from "@/lib/media";
import type { BlogArticle, BlogArticleListItem, BlogCategory, BlogTag } from "@/lib/domain";

type RawRow = Record<string, any>;

export const getBlogCategories = unstable_cache(
  async (): Promise<BlogCategory[]> => {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("blog_categories")
      .select("*")
      .order("name", { ascending: true });
    return ((data ?? []) as RawRow[]).map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
    }));
  },
  ["blog_categories"],
  { revalidate: 3600, tags: ["blog_categories"] },
);

export const getBlogTags = unstable_cache(
  async (): Promise<BlogTag[]> => {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("blog_tags")
      .select("*")
      .order("name", { ascending: true });
    return ((data ?? []) as RawRow[]).map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
    }));
  },
  ["blog_tags"],
  { revalidate: 3600, tags: ["blog_tags"] },
);

export const getBlogArticles = unstable_cache(
  async (
    options: {
      status?: "published" | "draft" | "scheduled" | "archived" | "all";
      categoryId?: string;
      limit?: number;
    } = {},
  ): Promise<BlogArticleListItem[]> => {
    const supabase = createAdminClient();
    let query = supabase
      .from("blog_articles")
      .select(`
        id, title, slug, excerpt, featured_image_url, featured_image_alt,
        status, reading_time_minutes, published_at, scheduled_at,
        author_name, author_id, category_id, updated_at, created_at,
        blog_categories(id, name, slug)
      `);

    if (options.status && options.status !== "all") {
      query = query.eq("status", options.status);
    }
    if (options.categoryId) {
      query = query.eq("category_id", options.categoryId);
    }

    query = query.order("published_at", { ascending: false, nullsFirst: false });

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) console.error("Error fetching blog articles:", error);

    return ((data ?? []) as RawRow[]).map((a) => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      excerpt: a.excerpt,
      featuredImageUrl: a.featured_image_url,
      featuredImageAlt: a.featured_image_alt,
      status: a.status,
      readingTimeMinutes: a.reading_time_minutes,
      publishedAt: a.published_at,
      scheduledAt: a.scheduled_at,
      authorName: a.author_name,
      authorId: a.author_id,
      categoryId: a.category_id,
      category: a.blog_categories ? {
        id: a.blog_categories.id,
        name: a.blog_categories.name,
        slug: a.blog_categories.slug,
      } : undefined,
      updatedAt: a.updated_at,
      createdAt: a.created_at,
    }));
  },
  ["blog_articles"],
  { revalidate: 60, tags: ["blog_articles"] },
);

export const getBlogArticleBySlug = unstable_cache(
  async (slug: string): Promise<BlogArticle | null> => {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("blog_articles")
      .select(`
        *,
        blog_categories(id, name, slug)
      `)
      .eq("slug", slug)
      .single();

    if (error || !data) return null;

    // Fetch tags via junction table
    const { data: tagData } = await supabase
      .from("blog_article_tags")
      .select("blog_tags(id, name, slug)")
      .eq("article_id", data.id);

    const tags = ((tagData ?? []) as RawRow[])
      .map(t => t.blog_tags)
      .filter(Boolean)
      .map(t => ({ id: t.id, name: t.name, slug: t.slug }));

    return {
      id: data.id,
      title: data.title,
      slug: data.slug,
      excerpt: data.excerpt,
      body: data.body,
      featuredImageUrl: data.featured_image_url,
      featuredImageAlt: data.featured_image_alt,
      socialImageUrl: data.social_image_url,
      canonicalUrl: data.canonical_url,
      status: data.status,
      metaTitle: data.meta_title,
      metaDescription: data.meta_description,
      readingTimeMinutes: data.reading_time_minutes,
      publishedAt: data.published_at,
      scheduledAt: data.scheduled_at,
      source: data.source,
      topicKey: data.topic_key,
      primaryKeyword: data.primary_keyword,
      authorName: data.author_name,
      authorId: data.author_id,
      categoryId: data.category_id,
      category: data.blog_categories ? {
        id: data.blog_categories.id,
        name: data.blog_categories.name,
        slug: data.blog_categories.slug,
      } : undefined,
      tags,
      updatedAt: data.updated_at,
      createdAt: data.created_at,
    };
  },
  ["blog_article_slug"],
  { revalidate: 60, tags: ["blog_articles"] },
);
