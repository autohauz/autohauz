import { getBlogArticles } from "@/lib/data/blog";
import { requirePermission } from "@/lib/security/auth";
import { Container } from "@/components/ui/container";
import { ButtonLink } from "@/components/ui/button";
import { Plus, Edit } from "lucide-react";
import { format } from "date-fns";

export const metadata = {
  title: "Blog",
};

export default async function BlogAdminPage() {
  await requirePermission("content.write");
  const articles = await getBlogArticles({ status: "all" });

  return (
    <Container>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-heading font-extrabold text-foreground">Blog Articles</h1>
          <p className="text-muted-foreground mt-1">Manage content marketing and SEO articles.</p>
        </div>
        <ButtonLink href="/admin/blog/new">
            <Plus className="mr-2 size-4" /> New Article
          </ButtonLink>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Author</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {articles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No articles found. Create your first post!
                  </td>
                </tr>
              ) : (
                articles.map((article) => (
                  <tr key={article.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground max-w-[300px] truncate">
                      {article.title}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        article.status === "published" ? "bg-success/10 text-success" : 
                        article.status === "draft" ? "bg-muted text-muted-foreground" :
                        "bg-warning/10 text-warning"
                      }`}>
                        {article.status.charAt(0).toUpperCase() + article.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {article.category?.name || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {article.authorName || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {format(new Date(article.createdAt), "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ButtonLink href={`/admin/blog/${article.id}`} variant="ghost" size="sm"  >
                          <Edit className="size-4" />
                        </ButtonLink>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Container>
  );
}
