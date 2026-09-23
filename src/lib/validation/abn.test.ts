import { describe, expect, it } from "vitest";
import { abnSchema, formatABN, isValidABN, optionalAbnSchema } from "./abn";

// 51 824 753 556 is the ATO's published example ABN.
const VALID = "51824753556";

describe("isValidABN", () => {
  it("accepts the ATO example ABN", () => {
    expect(isValidABN(VALID)).toBe(true);
    expect(isValidABN("51 824 753 556")).toBe(true);
  });

  it("rejects wrong length, letters, and a bad checksum", () => {
    expect(isValidABN("123")).toBe(false);
    expect(isValidABN("5182475355A")).toBe(false);
    expect(isValidABN("51824753557")).toBe(false);
  });
});

describe("abnSchema", () => {
  it("normalises spaces away and keeps digits", () => {
    expect(abnSchema.parse(" 51 824 753 556 ")).toBe(VALID);
  });

  it("rejects an invalid checksum with a readable message", () => {
    const result = abnSchema.safeParse("51824753557");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toMatch(/checksum/i);
  });
});

describe("optionalAbnSchema", () => {
  it("treats an empty form field as unset", () => {
    expect(optionalAbnSchema.parse("")).toBeUndefined();
    expect(optionalAbnSchema.parse("   ")).toBeUndefined();
  });

  it("still validates a supplied value", () => {
    expect(optionalAbnSchema.parse(VALID)).toBe(VALID);
    expect(optionalAbnSchema.safeParse("123").success).toBe(false);
  });
});

describe("formatABN", () => {
  it("groups as NN NNN NNN NNN", () => {
    expect(formatABN(VALID)).toBe("51 824 753 556");
  });
  it("returns the input unchanged when it is not 11 digits", () => {
    expect(formatABN("abc")).toBe("abc");
  });
});
