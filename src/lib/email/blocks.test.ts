import { describe, expect, it } from "vitest";
import { emailBlocksSchema, renderEmailHtml, renderEmailText, safeUrl, type EmailBlock, type RenderContext } from "./blocks";

const ctx: RenderContext = {
  sender: {
    name: "AutoHauz Pty Ltd",
    abn: "51 824 753 556",
    address: "1 Example St, Sydney NSW 2000",
    phone: "02 9000 0000",
    email: "hello@example.com.au",
    logoUrl: null,
    siteUrl: "https://autohauz.example",
  },
  unsubscribeUrl: "https://autohauz.example/newsletter/unsubscribe?t=abc",
  firstName: "Jane",
  vehicles: {
    "11111111-1111-4111-8111-111111111111": {
      id: "11111111-1111-4111-8111-111111111111",
      title: "2019 Toyota Corolla",
      priceText: "$21,990",
      detailText: "45,000 km · Automatic · Petrol",
      imageUrl: "https://abc.supabase.co/x.webp",
      url: "/used-cars/toyota/corolla/2019-toyota-corolla-a1",
    },
  },
};

describe("renderEmailHtml", () => {
  it("always includes sender identity, contact details and a working unsubscribe link", () => {
    const html = renderEmailHtml([{ type: "paragraph", text: "Hi" }], ctx, "Subject");
    expect(html).toContain("AutoHauz Pty Ltd");
    expect(html).toContain("ABN 51 824 753 556");
    expect(html).toContain("1 Example St, Sydney NSW 2000");
    expect(html).toContain('href="https://autohauz.example/newsletter/unsubscribe?t=abc"');
    expect(html).toContain('lang="en-AU"');
  });

  it("escapes staff text and personalises", () => {
    const html = renderEmailHtml([{ type: "heading", text: "Hi {{firstName}} <script>x</script>", level: 2 }], ctx, "S");
    expect(html).toContain("Hi Jane &lt;script&gt;x&lt;/script&gt;");
    expect(html).not.toContain("<script>x");
  });

  it("drops unsafe links and images", () => {
    const blocks: EmailBlock[] = [
      { type: "button", label: "Click", href: "javascript:alert(1)" },
      { type: "image", url: "http://evil.example/x.png", alt: "x" },
    ];
    const html = renderEmailHtml(blocks, ctx, "S");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("evil.example");
  });

  it("renders vehicle cards with absolute links, and omits vehicles no longer available", () => {
    const html = renderEmailHtml(
      [
        { type: "vehicle", vehicleId: "11111111-1111-4111-8111-111111111111" },
        { type: "vehicle", vehicleId: "22222222-2222-4222-8222-222222222222" },
      ],
      ctx,
      "S",
    );
    expect(html).toContain("2019 Toyota Corolla");
    expect(html).toContain("https://autohauz.example/used-cars/toyota/corolla/2019-toyota-corolla-a1");
    expect(html.match(/View this car/g)?.length).toBe(1);
  });

  it("uses table layout with inline styles only", () => {
    const html = renderEmailHtml([{ type: "divider" }], ctx, "S");
    expect(html).not.toMatch(/<style|display:\s*(flex|grid)/);
  });
});

describe("renderEmailText", () => {
  it("includes the unsubscribe link and sender", () => {
    const t = renderEmailText([{ type: "paragraph", text: "Hello {{firstName}}" }], ctx);
    expect(t).toContain("Hello Jane");
    expect(t).toContain("Unsubscribe: https://autohauz.example/newsletter/unsubscribe?t=abc");
    expect(t).toContain("AutoHauz Pty Ltd");
  });
});

describe("validation", () => {
  it("requires alt text on images and at least one block", () => {
    expect(emailBlocksSchema.safeParse([]).success).toBe(false);
    expect(emailBlocksSchema.safeParse([{ type: "image", url: "https://x.example/a.png", alt: "" }]).success).toBe(false);
    expect(emailBlocksSchema.safeParse([{ type: "divider" }]).success).toBe(true);
  });

  it("safeUrl resolves relative paths and refuses other schemes", () => {
    expect(safeUrl("/used-cars", "https://s.example")).toBe("https://s.example/used-cars");
    expect(safeUrl("//evil.example", "https://s.example")).toBeNull(); // protocol-relative is refused
    expect(safeUrl("ftp://x", "https://s.example")).toBeNull();
    expect(safeUrl("mailto:a@b.co", "https://s.example")).toBeNull();
    expect(safeUrl("mailto:a@b.co", "https://s.example", { allowMailto: true })).toBe("mailto:a@b.co");
  });
});
