import { notFound } from "next/navigation";
import { getBlogArticleBySlug, getBlogArticles } from "@/lib/data/blog";
import { Container } from "@/components/ui/container";
import { ArticleBody } from "@/components/blog/article-body";
import { ArticleCard } from "@/components/blog/article-card";
import { pageMetadata } from "@/lib/seo/metadata";
import { articleJsonLd } from "@/lib/seo/blog";
import Link from "next/link";
import { format } from "date-fns";
import { site } from "@/config/site";

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const article = await getBlogArticleBySlug(params.slug);
  
  if (!article || article.status !== "published") return {};

  return pageMetadata({
    path: article.canonicalUrl || `/blog/\${article.slug}`,
    title: article.metaTitle || `\${article.title} | \${site.brandName}`,
    description: article.metaDescription || article.excerpt || `Read \${article.title} on the \${site.brandName} blog.`,
    image: article.socialImageUrl || article.featuredImageUrl,
  });
}

export default async function ArticlePage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const article = await getBlogArticleBySlug(params.slug);
  
  if (!article || article.status !== "published") {
    notFound();
  }

  // Fetch recent articles in same category for "Related" sidebar
  const allArticles = await getBlogArticles({ 
    status: "published", 
    categoryId: article.categoryId || undefined,
    limit: 4 
  });
  
  const relatedArticles = allArticles.filter(a => a.id !== article.id).slice(0, 3);

  return (
    <>
      {/* Inject JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd(article)) }}
      />
      
      <main className="py-12 md:py-20 bg-background min-h-screen">
        <Container>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8">
            
            <div className="lg:col-span-8">
              {/* Breadcrumbs */}
              <nav className="flex text-sm text-muted-foreground mb-8">
                <ol className="flex items-center space-x-2">
                  <li><Link href="/" className="hover:text-foreground transition-colors">Home</Link></li>
                  <li><span className="mx-2">/</span></li>
                  <li><Link href="/blog" className="hover:text-foreground transition-colors">Blog</Link></li>
                  {article.category && (
                    <>
                      <li><span className="mx-2">/</span></li>
                      <li>
                        <Link href={`/blog/category/\${article.category.slug}`} className="hover:text-foreground transition-colors">
                          {article.category.name}
                        </Link>
                      </li>
                    </>
                  )}
                </ol>
              </nav>

              {/* Hero */}
              <header className="mb-10">
                <h1 className="text-3xl md:text-5xl font-heading font-extrabold text-foreground tracking-tight mb-6 leading-tight">
                  {article.title}
                </h1>
                
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  {article.authorName && (
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-full bg-muted flex items-center justify-center font-bold text-foreground">
                        {article.authorName.charAt(0)}
                      </div>
                      <span className="font-medium text-foreground">{article.authorName}</span>
                    </div>
                  )}
                  {article.authorName && <span>•</span>}
                  <time dateTime={article.publishedAt!}>
                    {format(new Date(article.publishedAt!), "MMMM d, yyyy")}
                  </time>
                  <span>•</span>
                  <span>{article.readingTimeMinutes} min read</span>
                </div>
              </header>

              {article.featuredImageUrl && (
                <div className="mb-12 rounded-2xl overflow-hidden bg-muted aspect-video border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={article.featuredImageUrl} 
                    alt={article.featuredImageAlt || article.title} 
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Body */}
              <div className="bg-card border border-border p-6 md:p-10 rounded-2xl">
                <ArticleBody html={article.body} />
                
                {article.tags && article.tags.length > 0 && (
                  <div className="mt-10 pt-6 border-t border-border">
                    <h3 className="text-sm font-semibold text-foreground mb-3">Tags:</h3>
                    <div className="flex flex-wrap gap-2">
                      {article.tags.map(tag => (
                        <span key={tag.id} className="px-3 py-1 bg-muted text-muted-foreground rounded-full text-xs font-medium">
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <aside className="lg:col-span-4 space-y-8">
              {relatedArticles.length > 0 && (
                <div className="bg-card border border-border rounded-2xl p-6 sticky top-24">
                  <h3 className="font-heading font-bold text-xl text-foreground mb-6 pb-4 border-b border-border">
                    Related Articles
                  </h3>
                  <div className="space-y-6">
                    {relatedArticles.map(rel => (
                      <article key={rel.id} className="group">
                        <Link href={`/blog/\${rel.slug}`} className="block">
                          {rel.featuredImageUrl && (
                            <div className="aspect-video rounded-xl overflow-hidden bg-muted mb-3 border border-border">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img 
                                src={rel.featuredImageUrl} 
                                alt="" 
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                              />
                            </div>
                          )}
                          <h4 className="font-heading font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                            {rel.title}
                          </h4>
                          <div className="text-xs text-muted-foreground mt-2">
                            {format(new Date(rel.publishedAt!), "MMM d, yyyy")}
                          </div>
                        </Link>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </div>
        </Container>
      </main>
    </>
  );
}
