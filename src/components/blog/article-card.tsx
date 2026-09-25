import Link from "next/link";
import { format } from "date-fns";
import type { BlogArticleListItem } from "@/lib/domain";
import { site } from "@/config/site";

/**
 * Blog card. One link (the title) stretched over the card, so the card is a
 * single tab stop; the image repeats that link for pointer users only.
 */
export function ArticleCard({ article, priority = false }: { article: BlogArticleListItem; priority?: boolean }) {
  const href = `/blog/${article.slug}`;
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow duration-200 hover:shadow-card">
      <div className="aspect-[16/10] overflow-hidden bg-muted" aria-hidden="true">
        {article.featuredImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.featuredImageUrl}
            alt=""
            className="h-full w-full object-cover"
            loading={priority ? "eager" : "lazy"}
          />
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-6">
        <div className="mb-3 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {article.category && (
            <Link href={`/blog/category/${article.category.slug}`} className="relative z-10 text-accent hover:underline">
              {article.category.name}
            </Link>
          )}
          {article.category && <span aria-hidden="true">•</span>}
          <span>{article.readingTimeMinutes} min read</span>
        </div>

        <h2 className="mb-3 line-clamp-2 font-heading text-xl font-bold text-foreground group-hover:text-primary">
          <Link href={href} className="before:absolute before:inset-0">
            {article.title}
          </Link>
        </h2>

        {article.excerpt && <p className="mb-6 line-clamp-3 flex-1 text-muted-foreground">{article.excerpt}</p>}

        <div className="mt-auto flex items-center gap-3 border-t border-border pt-4 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{article.authorName || site.brandName}</span>
          {article.publishedAt ? (
            <>
              <span aria-hidden="true">•</span>
              <time dateTime={article.publishedAt}>{format(new Date(article.publishedAt), "d MMM yyyy")}</time>
            </>
          ) : null}
        </div>
      </div>
    </article>
  );
}
