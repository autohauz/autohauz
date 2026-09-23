import { describe, expect, it } from "vitest";
import { serializeJsonLd } from "./json-ld";

const LINE_SEP = String.fromCharCode(0x2028);

describe("serializeJsonLd", () => {
  it("neutralises a script-closing sequence inside string values", () => {
    const out = serializeJsonLd({ description: 'nice car </script><img src=x onerror="alert(1)">' });
    expect(out).not.toContain("</script>");
    expect(out).not.toContain("<img");
    // Still valid JSON that round-trips to the original text.
    expect(JSON.parse(out).description).toBe('nice car </script><img src=x onerror="alert(1)">');
  });

  it("escapes ampersands and unicode line separators", () => {
    const out = serializeJsonLd({ a: "Tom & Jerry" + LINE_SEP + "x" });
    expect(out).toContain("\\u0026");
    expect(out).toContain("\\u2028");
    expect(out).not.toContain("&");
    expect(out).not.toContain(LINE_SEP);
    expect(JSON.parse(out).a).toBe("Tom & Jerry" + LINE_SEP + "x");
  });

  it("leaves ordinary schema untouched", () => {
    const schema = { "@context": "https://schema.org", "@type": "Organization", name: "AutoHauz" };
    expect(JSON.parse(serializeJsonLd(schema))).toEqual(schema);
  });
});
