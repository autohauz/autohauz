import { getBlogArticles, getBlogCategories } from "@/lib/data/blog";
import { Container } from "@/components/ui/container";
import { ArticleCard } from "@/components/blog/article-card";
import { pageMetadata } from "@/lib/seo/metadata";
import Link from "next/link";
import { site } from "@/config/site";
import { notFound } from "next/navigation";

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const categories = await getBlogCategories();
  const category = categories.find((c) => c.slug === params.slug);
  
  if (!category) return {};

  return pageMetadata({
    path: `/blog/category/\${category.slug}`,
    title: `\${category.name} Articles | \${site.brandName} Blog`,
    description: `Read our latest articles and advice on \${category.name}.`,
  });
}

export default async function BlogCategoryPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  
  const categories = await getBlogCategories();
  const category = categories.find((c) => c.slug === params.slug);
  
  if (!category) {
    notFound();
  }

  const articles = await getBlogArticles({ status: "published", categoryId: category.id });

  return (
    <main className="py-12 md:py-20 bg-background min-h-screen">
      <Container>
        <div className="max-w-3xl mb-12">
          <Link href="/blog" className="text-primary hover:underline text-sm font-semibold mb-4 inline-block">
            &larr; Back to all articles
          </Link>
          <h1 className="text-4xl md:text-5xl font-heading font-extrabold text-foreground tracking-tight mb-4">
            {category.name}
          </h1>
          <p className="text-lg text-muted-foreground">
            Articles and guides related to {category.name}.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 mb-12">
          <Link 
            href="/blog" 
            className="px-4 py-2 bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground rounded-full text-sm font-semibold transition-colors"
          >
            All Articles
          </Link>
          {categories.map((c) => (
            <Link 
              key={c.id} 
              href={`/blog/category/\${c.slug}`}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors \${
                c.id === category.id 
                  ? "bg-primary text-primary-foreground shadow-sm" 
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              {c.name}
            </Link>
          ))}
        </div>

        {articles.length === 0 ? (
          <div className="text-center py-20 bg-card border border-border rounded-2xl">
            <h2 className="text-xl font-bold text-foreground mb-2">No articles yet</h2>
            <p className="text-muted-foreground">Check back soon for new content in this category.</p>
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
