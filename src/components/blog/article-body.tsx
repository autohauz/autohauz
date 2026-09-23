import DOMPurify from "isomorphic-dompurify";

export function ArticleBody({ html }: { html: string }) {
  // Defensive sanitization on render (even though it's sanitized on save)
  const cleanHtml = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'class'],
  });

  return (
    <div 
      className="prose prose-sm sm:prose-base lg:prose-lg dark:prose-invert max-w-none 
                 prose-img:rounded-xl prose-img:shadow-md 
                 prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                 prose-headings:font-heading prose-headings:font-bold"
      dangerouslySetInnerHTML={{ __html: cleanHtml }}
    />
  );
}
