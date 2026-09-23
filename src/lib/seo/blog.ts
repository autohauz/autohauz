import { absoluteUrl } from "@/lib/seo/site";
import { site } from "@/config/site";
import type { BlogArticle } from "@/lib/domain";

/**
 * Generates JSON-LD Article schema for a blog post.
 */
export function articleJsonLd(article: BlogArticle) {
  const url = absoluteUrl(`/blog/\${article.slug}`);
  const imageUrl = article.socialImageUrl || article.featuredImageUrl || site.assets.ogImage;

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.metaTitle || article.title,
    description: article.metaDescription || article.excerpt || "",
    image: [imageUrl],
    datePublished: article.publishedAt ? new Date(article.publishedAt).toISOString() : undefined,
    dateModified: article.updatedAt ? new Date(article.updatedAt).toISOString() : undefined,
    author: {
      "@type": "Person",
      name: article.authorName || site.brandName,
    },
    publisher: {
      "@type": "Organization",
      name: site.brandName,
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl("/brand/logo.png"),
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
  };
}
