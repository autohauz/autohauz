import { afterEach, describe, expect, it } from "vitest";
import { clientIp } from "./ip";

const h = (init: Record<string, string>) => new Headers(init);

describe("clientIp", () => {
  afterEach(() => {
    delete process.env.VERCEL;
    delete process.env.GEO_TRUST_PROXY_HEADERS;
  });

  it("ignores a client-supplied cf-connecting-ip on Vercel", () => {
    process.env.VERCEL = "1";
    expect(clientIp(h({ "cf-connecting-ip": "1.1.1.1", "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("ignores cf-connecting-ip when not explicitly behind Cloudflare", () => {
    expect(clientIp(h({ "cf-connecting-ip": "1.1.1.1", "x-forwarded-for": "203.0.113.9, 10.0.0.1" }))).toBe(
      "203.0.113.9",
    );
  });

  it("trusts cf-connecting-ip only with the explicit opt-in", () => {
    process.env.GEO_TRUST_PROXY_HEADERS = "true";
    expect(clientIp(h({ "cf-connecting-ip": "198.51.100.7", "x-forwarded-for": "10.0.0.1" }))).toBe("198.51.100.7");
  });

  it("falls back to a fixed value with no headers", () => {
    expect(clientIp(h({}))).toBe("0.0.0.0");
  });
});
