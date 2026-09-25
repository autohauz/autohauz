import { describe, expect, it } from "vitest";
import { validationMessage } from "./submit";

describe("validationMessage", () => {
  it("names a single field", () => {
    expect(validationMessage({ phone: ["Too short"] })).toBe("Please check your phone number.");
  });

  it("lists several fields in order", () => {
    expect(validationMessage({ name: ["x"], phone: ["x"], email: ["x"] })).toBe(
      "Please check your name, phone number and email address.",
    );
  });

  it("ignores empty and internal fields", () => {
    expect(validationMessage({ email: [], meta: ["x"], vehicleId: ["x"] })).toBeNull();
  });
});
