import { absoluteUrl, siteBaseUrl } from "@/lib/seo/site";
import { site } from "@/config/site";
import type { BlogArticle } from "@/lib/domain";

/**
 * The path an article canonicalises to.
 *
 * Staff may override the canonical, but only onto this site: a root-relative
 * path or an absolute URL on our own origin. Anything else (another domain, a
 * malformed value) falls back to the article's own URL — an off-site
 * canonical silently de-indexes the post.
 */
export function articleCanonicalPath(article: Pick<BlogArticle, "slug" | "canonicalUrl">): string {
  const own = `/blog/${article.slug}`;
  const raw = article.canonicalUrl?.trim();
  if (!raw) return own;
  try {
    const base = new URL(siteBaseUrl());
    const resolved = new URL(raw, base);
    if (resolved.origin !== base.origin) return own;
    return resolved.pathname;
  } catch {
    return own;
  }
}

/**
 * Generates JSON-LD Article schema for a blog post.
 */
export function articleJsonLd(article: BlogArticle) {
  const url = absoluteUrl(articleCanonicalPath(article));
  const imageUrl = article.socialImageUrl || article.featuredImageUrl || site.assets.ogImage;

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.metaTitle || article.title,
    description: article.metaDescription || article.excerpt || "",
    image: [imageUrl],
    datePublished: article.publishedAt ? new Date(article.publishedAt).toISOString() : undefined,
    dateModified: article.updatedAt ? new Date(article.updatedAt).toISOString() : undefined,
    // A named person when there is one; otherwise the business itself is the
    // author (it is not a Person, and schema.org says so).
    author: article.authorName
      ? { "@type": "Person", name: article.authorName }
      : { "@type": "Organization", name: site.brandName, url: absoluteUrl("/") },
    publisher: {
      "@type": "Organization",
      name: site.brandName,
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl(site.assets.logoPrimary),
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
  };
}
