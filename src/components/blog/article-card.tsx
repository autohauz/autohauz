import Link from "next/link";
import { format } from "date-fns";
import type { BlogArticleListItem } from "@/lib/domain";

export function ArticleCard({ article, priority = false }: { article: BlogArticleListItem; priority?: boolean }) {
  return (
    <article className="group flex flex-col bg-card border border-border rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300">
      <Link href={`/blog/\${article.slug}`} className="relative aspect-[16/10] overflow-hidden bg-muted block">
        {article.featuredImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.featuredImageUrl}
            alt={article.featuredImageAlt || article.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading={priority ? "eager" : "lazy"}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted/80 text-muted-foreground">
            <span className="opacity-50">No Image</span>
          </div>
        )}
      </Link>
      
      <div className="p-6 flex flex-col flex-1">
        <div className="flex items-center gap-3 text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
          {article.category && (
            <Link href={`/blog/category/\${article.category.slug}`} className="text-primary hover:text-primary-hover transition-colors z-10 relative">
              {article.category.name}
            </Link>
          )}
          {article.category && <span>•</span>}
          <span>{article.readingTimeMinutes} min read</span>
        </div>
        
        <h3 className="text-xl font-heading font-bold text-foreground mb-3 line-clamp-2 group-hover:text-primary transition-colors">
          <Link href={`/blog/\${article.slug}`} className="before:absolute before:inset-0">
            {article.title}
          </Link>
        </h3>
        
        {article.excerpt && (
          <p className="text-muted-foreground line-clamp-3 mb-6 flex-1">
            {article.excerpt}
          </p>
        )}
        
        <div className="mt-auto flex items-center gap-3 text-sm text-muted-foreground border-t border-border pt-4">
          <div className="font-medium text-foreground">{article.authorName || "AutoHauz"}</div>
          <span>•</span>
          <time dateTime={article.publishedAt!}>
            {format(new Date(article.publishedAt!), "MMM d, yyyy")}
          </time>
        </div>
      </div>
    </article>
  );
}
