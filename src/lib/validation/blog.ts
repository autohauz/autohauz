import { z } from "zod";

export const BLOG_STATUSES = ["draft", "scheduled", "published", "archived"] as const;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

/**
 * Images must be served from our own storage (or our own site), never an
 * arbitrary third-party host that could change the content later.
 */
export function isAllowedImageUrl(url: string, supabaseUrl: string | undefined): boolean {
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    return Boolean(supabaseUrl) && u.origin === new URL(supabaseUrl!).origin && u.pathname.startsWith("/storage/v1/object/public/media/");
  } catch {
    return false;
  }
}

export function blogArticleSchema(opts: { supabaseUrl?: string; now?: Date }) {
  const imageUrl = z
    .string()
    .trim()
    .max(2048)
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || isAllowedImageUrl(v, opts.supabaseUrl), "Images must be uploaded through the editor");

  return z
    .object({
      title: z.string().trim().min(1, "Title is required").max(200),
      slug: z.string().trim().toLowerCase().max(120).regex(SLUG, "Slug may contain lowercase letters, numbers and hyphens only"),
      body: z.string().min(1, "Body is required").max(500_000, "The article is too long"),
      excerpt: optional(500),
      status: z.enum(BLOG_STATUSES),
      categoryId: z.string().uuid().optional().or(z.literal("")).transform((v) => v || null),
      authorName: optional(120),
      scheduledAt: optional(40),
      featuredImageUrl: imageUrl,
      featuredImageAlt: optional(300),
      metaTitle: optional(70),
      metaDescription: optional(170),
      canonicalUrl: optional(2048),
    })
    .superRefine((d, ctx) => {
      if (d.status === "scheduled") {
        const when = d.scheduledAt ? new Date(d.scheduledAt) : null;
        if (!when || Number.isNaN(when.getTime())) {
          ctx.addIssue({ code: "custom", path: ["scheduledAt"], message: "Choose a date and time to publish" });
        } else if (when.getTime() <= (opts.now ?? new Date()).getTime()) {
          ctx.addIssue({ code: "custom", path: ["scheduledAt"], message: "The scheduled time must be in the future" });
        }
      }
      if (d.featuredImageUrl && !d.featuredImageAlt) {
        ctx.addIssue({ code: "custom", path: ["featuredImageAlt"], message: "Describe the featured image (alt text)" });
      }
    });
}

export type BlogArticleInput = z.output<ReturnType<typeof blogArticleSchema>>;

export function blogArticleFromForm(form: FormData): Record<string, string | undefined> {
  const keys = [
    "title", "slug", "body", "excerpt", "status", "categoryId", "authorName", "scheduledAt",
    "featuredImageUrl", "featuredImageAlt", "metaTitle", "metaDescription", "canonicalUrl",
  ];
  return Object.fromEntries(keys.map((k) => [k, form.get(k)?.toString() ?? undefined]));
}

export const blogCategorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  slug: z.string().trim().toLowerCase().max(80).regex(SLUG, "Slug may contain lowercase letters, numbers and hyphens only"),
});
