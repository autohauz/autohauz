import { getBlogArticles, getBlogCategories } from "@/lib/data/blog";
import { Container } from "@/components/ui/container";
import { ArticleCard } from "@/components/blog/article-card";
import { pageMetadata } from "@/lib/seo/metadata";
import Link from "next/link";
import { site } from "@/config/site";

export const metadata = pageMetadata({
  path: "/blog",
  title: `Blog & Car Buying Advice | \${site.brandName}`,
  description: "Read the latest news, car reviews, and buying advice from our auto experts.",
});

export default async function BlogIndexPage() {
  const articles = await getBlogArticles({ status: "published" });
  const categories = await getBlogCategories();

  return (
    <main className="py-12 md:py-20 bg-background min-h-screen">
      <Container>
        <div className="max-w-3xl mb-12">
          <h1 className="text-4xl md:text-5xl font-heading font-extrabold text-foreground tracking-tight mb-4">
            The <span className="text-primary">AutoHauz</span> Blog
          </h1>
          <p className="text-lg text-muted-foreground">
            News, reviews, and expert advice to help you find and maintain your perfect vehicle.
          </p>
        </div>

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-12">
            <Link 
              href="/blog" 
              className="px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-semibold shadow-sm transition-transform hover:-translate-y-0.5"
            >
              All Articles
            </Link>
            {categories.map((c) => (
              <Link 
                key={c.id} 
                href={`/blog/category/\${c.slug}`}
                className="px-4 py-2 bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground rounded-full text-sm font-semibold transition-colors"
              >
                {c.name}
              </Link>
            ))}
          </div>
        )}

        {articles.length === 0 ? (
          <div className="text-center py-20 bg-card border border-border rounded-2xl">
            <h2 className="text-xl font-bold text-foreground mb-2">No articles yet</h2>
            <p className="text-muted-foreground">Check back soon for our latest updates.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {articles.map((article, i) => (
              <ArticleCard key={article.id} article={article} priority={i < 3} />
            ))}
          </div>
        )}
      </Container>
    </main>
  );
}
