import DOMPurify from "isomorphic-dompurify";

/**
 * The single sanitiser for staff-authored rich HTML (blog articles).
 *
 * Runs on the server when an article is SAVED — the stored HTML is already
 * safe — and again when rendering, so rows written before this existed (or by
 * other tools) are covered too. The editor's own client-side cleaning is a
 * convenience, not a trust boundary.
 *
 * Policy: DOMPurify's HTML profile (no script/style/iframe/event handlers,
 * no javascript: URLs), no inline `style`, and every link that opens a new
 * tab gets rel="noopener noreferrer".
 */
let hooked = false;

function ensureHooks() {
  if (hooked) return;
  hooked = true;
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A" && node.getAttribute("target") === "_blank") {
      node.setAttribute("rel", "noopener noreferrer");
    }
  });
}

export function sanitizeArticleHtml(html: string): string {
  ensureHooks();
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ["target"],
    FORBID_ATTR: ["style"],
    FORBID_TAGS: ["style", "form", "input", "button", "textarea", "select"],
  });
}

/** Plain-text word count of article HTML, for reading time. */
export function wordCount(html: string): number {
  const text = html.replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/gi, " ");
  return text.split(/\s+/).filter(Boolean).length;
}
