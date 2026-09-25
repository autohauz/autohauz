import { getBlogCategories } from "@/lib/data/blog";
import { requirePermission } from "@/lib/security/auth";
import { Container } from "@/components/ui/container";
import { CategoryManager } from "@/components/admin/category-manager";

export const metadata = {
  title: "Blog categories",
};

export default async function BlogCategoriesPage() {
  await requirePermission("content.write");
  const categories = await getBlogCategories();

  return (
    <Container>
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-extrabold text-foreground">Categories</h1>
        <p className="text-muted-foreground mt-1">Manage blog categories.</p>
      </div>

      <CategoryManager initialCategories={categories} />
    </Container>
  );
}
