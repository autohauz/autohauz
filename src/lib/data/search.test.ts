import { describe, expect, it } from "vitest";
import { sanitizeSearchTerm } from "./search";

describe("sanitizeSearchTerm", () => {
  it("keeps names, emails, phones and document numbers", () => {
    expect(sanitizeSearchTerm("  Jane O'Brien ")).toBe("Jane O'Brien");
    expect(sanitizeSearchTerm("jane+1@example.com.au")).toBe("jane+1@example.com.au");
    expect(sanitizeSearchTerm("0412 345 678")).toBe("0412 345 678");
    expect(sanitizeSearchTerm("AH-2026-000123")).toBe("AH-2026-000123");
    expect(sanitizeSearchTerm("Zoë Nguyễn")).toBe("Zoë Nguyễn");
  });

  it("strips PostgREST filter syntax and LIKE wildcards", () => {
    expect(sanitizeSearchTerm("x,status.eq.paid")).toBe("x status.eq.paid");
    expect(sanitizeSearchTerm("a)or(b")).toBe("a or b");
    expect(sanitizeSearchTerm('%_*"\\')).toBe("");
  });

  it("caps length and handles empties", () => {
    expect(sanitizeSearchTerm("a".repeat(500))).toHaveLength(100);
    expect(sanitizeSearchTerm(null)).toBe("");
  });
});
