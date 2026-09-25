import { notFound } from "next/navigation";
import { getBlogArticleById, getBlogCategories } from "@/lib/data/blog";
import { requirePermission } from "@/lib/security/auth";
import { Container } from "@/components/ui/container";
import { BlogForm } from "@/components/admin/blog-form";

export const metadata = {
  title: "Edit article",
};

export default async function EditBlogArticlePage(props: { params: Promise<{ id: string }> }) {
  await requirePermission("content.write");
  const params = await props.params;

  const article = await getBlogArticleById(params.id);
  if (!article) notFound();

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
