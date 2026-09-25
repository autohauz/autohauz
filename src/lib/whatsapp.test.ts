import { describe, expect, it } from "vitest";
import { buildWhatsAppUrl, normaliseWhatsAppNumber } from "./whatsapp";

describe("normaliseWhatsAppNumber", () => {
  it.each([
    ["0412 345 678", "61412345678"],
    ["0412-345-678", "61412345678"],
    ["+61 412 345 678", "61412345678"],
    ["+61412345678", "61412345678"],
    ["61412345678", "61412345678"],
    ["+61 (0) 412 345 678", "61412345678"],
    ["+61 0412 345 678", "61412345678"],
    ["0061 412 345 678", "61412345678"],
    ["0011 61 412 345 678", "61412345678"],
    ["412 345 678", "61412345678"],
    ["(02) 9876 5432", "61298765432"],
    ["03 9123 4567", "61391234567"],
    ["08 8123 4567", "61881234567"],
  ])("%s → %s", (input, expected) => {
    expect(normaliseWhatsAppNumber(input)).toBe(expected);
  });

  it("keeps other countries' numbers", () => {
    expect(normaliseWhatsAppNumber("+64 21 123 4567")).toBe("64211234567");
    expect(normaliseWhatsAppNumber("+91 98765 43210")).toBe("919876543210");
  });
});

describe("buildWhatsAppUrl", () => {
  it("builds a wa.me link with an encoded message", () => {
    expect(buildWhatsAppUrl("0412 345 678", "Hi, is the 2019 Corolla (stock A1) available?")).toBe(
      "https://wa.me/61412345678?text=Hi%2C%20is%20the%202019%20Corolla%20(stock%20A1)%20available%3F",
    );
    expect(buildWhatsAppUrl("+61412345678")).toBe("https://wa.me/61412345678");
  });
});
