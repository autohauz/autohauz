import { unstable_cache } from "next/cache";
import { requirePermission } from "@/lib/security/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BlogArticle, BlogArticleListItem, BlogCategory, BlogStatus, BlogTag } from "@/lib/domain";

/** Row shapes as PostgREST returns them (snake_case; see migrations 0011/0023). */
type CategoryRow = { id: string; name: string; slug: string };
type TagRow = CategoryRow;

type ArticleListRow = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image_url: string | null;
  featured_image_alt: string | null;
  status: BlogStatus;
  reading_time_minutes: number | null;
  published_at: string | null;
  scheduled_at: string | null;
  author_name: string | null;
  author_id: string | null;
  category_id: string | null;
  updated_at: string;
  created_at: string;
  blog_categories: CategoryRow | null;
};

type ArticleRow = ArticleListRow & {
  body: string;
  meta_title: string | null;
  meta_description: string | null;
  source: string;
  topic_key: string | null;
  primary_keyword: string | null;
  social_image_url: string | null;
  canonical_url: string | null;
};

const toCategory = (c: CategoryRow): BlogCategory => ({ id: c.id, name: c.name, slug: c.slug });

/**
 * Whether an article is live on the public site. A scheduled article goes
 * live at its scheduled time without waiting for a job to flip its status.
 */
export function isPubliclyVisible(a: Pick<BlogArticleListItem, "status" | "scheduledAt">, now = new Date()): boolean {
  if (a.status === "published") return true;
  return a.status === "scheduled" && a.scheduledAt !== null && new Date(a.scheduledAt).getTime() <= now.getTime();
}

function toListItem(a: ArticleListRow): BlogArticleListItem {
  return {
    id: a.id,
    title: a.title,
    slug: a.slug,
    excerpt: a.excerpt,
    featuredImageUrl: a.featured_image_url,
    featuredImageAlt: a.featured_image_alt,
    status: a.status,
    readingTimeMinutes: a.reading_time_minutes ?? 1,
    // A scheduled post that has gone live shows its scheduled time as its date.
    publishedAt: a.published_at ?? (a.status === "scheduled" ? a.scheduled_at : null),
    scheduledAt: a.scheduled_at,
    authorName: a.author_name,
    authorId: a.author_id,
    categoryId: a.category_id,
    category: a.blog_categories ? toCategory(a.blog_categories) : undefined,
    updatedAt: a.updated_at,
    createdAt: a.created_at,
  };
}

export const getBlogCategories = unstable_cache(
  async (): Promise<BlogCategory[]> => {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("blog_categories")
      .select("id, name, slug")
      .order("name", { ascending: true });
    if (error) console.error("[blog] categories query failed:", error.message);
    return ((data ?? []) as CategoryRow[]).map(toCategory);
  },
  ["blog_categories"],
  { revalidate: 3600, tags: ["blog_categories"] },
);

export const getBlogTags = unstable_cache(
  async (): Promise<BlogTag[]> => {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("blog_tags")
      .select("id, name, slug")
      .order("name", { ascending: true });
    if (error) console.error("[blog] tags query failed:", error.message);
    return ((data ?? []) as TagRow[]).map(toCategory);
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

    if (options.status === "published") {
      query = query.or(`status.eq.published,and(status.eq.scheduled,scheduled_at.lte.${new Date().toISOString()})`);
    } else if (options.status && options.status !== "all") {
      query = query.eq("status", options.status);
    }
    if (options.categoryId) {
      query = query.eq("category_id", options.categoryId);
    }

    query = query
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("scheduled_at", { ascending: false, nullsFirst: false });

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) console.error("[blog] articles query failed:", error.message);

    return ((data ?? []) as unknown as ArticleListRow[]).map(toListItem);
  },
  ["blog_articles"],
  { revalidate: 60, tags: ["blog_articles"] },
);

async function loadArticle(column: "slug" | "id", value: string): Promise<BlogArticle | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("blog_articles")
    .select(`
      *,
      blog_categories(id, name, slug)
    `)
    .eq(column, value)
    .maybeSingle();

  if (error) console.error("[blog] article query failed:", error.message);
  if (!data) return null;
  const row = data as unknown as ArticleRow;

  // Tags via the junction table (migration 0023).
  const { data: tagData } = await supabase
    .from("blog_article_tags")
    .select("blog_tags(id, name, slug)")
    .eq("article_id", row.id);

  const tags = ((tagData ?? []) as unknown as { blog_tags: TagRow | null }[])
    .flatMap((t) => (t.blog_tags ? [toCategory(t.blog_tags)] : []));

  return {
    ...toListItem(row),
    body: row.body,
    metaTitle: row.meta_title,
    metaDescription: row.meta_description,
    source: row.source,
    topicKey: row.topic_key,
    primaryKeyword: row.primary_keyword,
    socialImageUrl: row.social_image_url,
    canonicalUrl: row.canonical_url,
    tags,
  };
}

/** Admin editor read: uncached, any status. */
export async function getBlogArticleById(id: string): Promise<BlogArticle | null> {
  await requirePermission("content.write");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return loadArticle("id", id);
}

export const getBlogArticleBySlug = unstable_cache(
  async (slug: string): Promise<BlogArticle | null> => loadArticle("slug", slug),
  ["blog_article_slug"],
  { revalidate: 60, tags: ["blog_articles"] },
);
