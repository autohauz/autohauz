import { describe, expect, it } from "vitest";
import { sanitizeArticleHtml, wordCount } from "./sanitize";
import { blogArticleSchema, isAllowedImageUrl } from "@/lib/validation/blog";

describe("sanitizeArticleHtml", () => {
  it.each([
    ["<script>alert(1)</script><p>ok</p>", "<p>ok</p>"],
    ['<img src="x" onerror="alert(1)">', '<img src="x">'],
    ['<a href="javascript:alert(1)">x</a>', "<a>x</a>"],
    ['<iframe src="https://evil.example"></iframe><p>ok</p>', "<p>ok</p>"],
    ['<p style="position:fixed">x</p>', "<p>x</p>"],
    ["<svg><script>alert(1)</script></svg>", ""],
  ])("neutralises %s", (input, expected) => {
    expect(sanitizeArticleHtml(input)).toBe(expected);
  });

  it("keeps normal formatting and forces noopener on new-tab links", () => {
    const out = sanitizeArticleHtml('<h2>Title</h2><p><strong>b</strong> <a href="https://example.com" target="_blank">l</a></p>');
    expect(out).toContain("<h2>Title</h2>");
    expect(out).toContain("<strong>b</strong>");
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it("counts words, not markup", () => {
    expect(wordCount("<p>one two</p><p>three&nbsp;four</p>")).toBe(4);
  });
});

describe("blog article schema", () => {
  const supabaseUrl = "https://abc.supabase.co";
  const base = {
    title: "T",
    slug: "a-post",
    body: "<p>x</p>",
    status: "draft",
  };
  const schema = blogArticleSchema({ supabaseUrl, now: new Date("2026-01-01T00:00:00Z") });

  it("accepts a minimal draft", () => {
    expect(schema.safeParse(base).success).toBe(true);
  });

  it("rejects bad slugs, unknown statuses and past schedules", () => {
    expect(schema.safeParse({ ...base, slug: "Bad Slug!" }).success).toBe(false);
    expect(schema.safeParse({ ...base, status: "live" }).success).toBe(false);
    expect(schema.safeParse({ ...base, status: "scheduled" }).success).toBe(false);
    expect(schema.safeParse({ ...base, status: "scheduled", scheduledAt: "2025-12-31T00:00" }).success).toBe(false);
    expect(schema.safeParse({ ...base, status: "scheduled", scheduledAt: "2026-02-01T09:00" }).success).toBe(true);
  });

  it("only allows images from our own storage, with alt text", () => {
    const own = `${supabaseUrl}/storage/v1/object/public/media/blog/x.webp`;
    expect(isAllowedImageUrl(own, supabaseUrl)).toBe(true);
    expect(isAllowedImageUrl("https://evil.example/x.png", supabaseUrl)).toBe(false);
    expect(isAllowedImageUrl("javascript:alert(1)", supabaseUrl)).toBe(false);
    expect(schema.safeParse({ ...base, featuredImageUrl: own }).success).toBe(false); // no alt
    expect(schema.safeParse({ ...base, featuredImageUrl: own, featuredImageAlt: "A car" }).success).toBe(true);
  });
});
