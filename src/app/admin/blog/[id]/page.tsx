import { notFound } from "next/navigation";
import { getBlogCategories } from "@/lib/data/blog";
import { requireAdminRole } from "@/lib/security/auth";
import { Container } from "@/components/ui/container";
import { BlogForm } from "@/components/admin/blog-form";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = {
  title: "Edit Blog Article | AutoHauz Admin",
};

export default async function EditBlogArticlePage(props: { params: Promise<{ id: string }> }) {
  await requireAdminRole(["content", "owner", "admin"]);
  const params = await props.params;

  // We fetch directly by ID here since getBlogArticleBySlug is the public cache, 
  // and we want uncached admin data for editing.
  const supabase = createAdminClient();
  const { data: articleData, error } = await supabase
    .from("blog_articles")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !articleData) {
    notFound();
  }

  const article = {
    id: articleData.id,
    title: articleData.title,
    slug: articleData.slug,
    body: articleData.body,
    excerpt: articleData.excerpt,
    featuredImageUrl: articleData.featured_image_url,
    featuredImageAlt: articleData.featured_image_alt,
    socialImageUrl: articleData.social_image_url,
    canonicalUrl: articleData.canonical_url,
    status: articleData.status,
    metaTitle: articleData.meta_title,
    metaDescription: articleData.meta_description,
    readingTimeMinutes: articleData.reading_time_minutes,
    publishedAt: articleData.published_at,
    scheduledAt: articleData.scheduled_at,
    source: articleData.source,
    topicKey: articleData.topic_key,
    primaryKeyword: articleData.primary_keyword,
    authorName: articleData.author_name,
    authorId: articleData.author_id,
    categoryId: articleData.category_id,
    updatedAt: articleData.updated_at,
    createdAt: articleData.created_at,
  } as any;

  const categories = await getBlogCategories();

  return (
    <Container>
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-extrabold text-foreground">Edit Article</h1>
        <p className="text-muted-foreground mt-1">Make changes to this blog post.</p>
      </div>

      <BlogForm article={article} categories={categories} />
    </Container>
  );
}
