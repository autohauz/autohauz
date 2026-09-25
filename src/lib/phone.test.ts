import { describe, expect, it } from "vitest";
import { formatPhoneForDisplay, telHref } from "./phone";

describe("formatPhoneForDisplay", () => {
  it.each([
    ["+61492962418", "0492 962 418"],
    ["0492962418", "0492 962 418"],
    ["61492962418", "0492 962 418"],
    ["+61298765432", "(02) 9876 5432"],
    ["1300123456", "1300 123 456"],
    ["131234", "13 12 34"],
  ])("%s → %s", (raw, expected) => {
    expect(formatPhoneForDisplay(raw)).toBe(expected);
  });

  it("keeps a number the owner already spaced", () => {
    expect(formatPhoneForDisplay("02 9876 5432")).toBe("02 9876 5432");
  });

  it("leaves unrecognised numbers alone", () => {
    expect(formatPhoneForDisplay("+14155550100")).toBe("+14155550100");
  });
});

describe("telHref", () => {
  it("strips formatting", () => {
    expect(telHref("(02) 9876-5432")).toBe("tel:0298765432");
    expect(telHref("+61 492 962 418")).toBe("tel:+61492962418");
  });
});
