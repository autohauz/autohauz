import { sanitizeArticleHtml } from "@/lib/content/sanitize";

/**
 * Article HTML is sanitised when saved (admin/blog/actions.ts); sanitising
 * again here covers rows written before that existed or by other tools.
 */
export function ArticleBody({ html }: { html: string }) {
  return (
    <div
      className="prose prose-sm max-w-none sm:prose-base lg:prose-lg dark:prose-invert prose-headings:font-heading prose-headings:font-bold prose-a:text-primary prose-img:rounded-xl"
      dangerouslySetInnerHTML={{ __html: sanitizeArticleHtml(html) }}
    />
  );
}
