import { getBlogCategories } from "@/lib/data/blog";
import { requirePermission } from "@/lib/security/auth";
import { Container } from "@/components/ui/container";
import { BlogForm } from "@/components/admin/blog-form";

export const metadata = {
  title: "New article",
};

export default async function NewBlogArticlePage() {
  await requirePermission("content.write");
  const categories = await getBlogCategories();

  return (
    <Container>
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-extrabold text-foreground">New Article</h1>
        <p className="text-muted-foreground mt-1">Create a new blog post.</p>
      </div>

      <BlogForm categories={categories} />
    </Container>
  );
}
