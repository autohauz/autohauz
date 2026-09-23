import { describe, expect, it } from "vitest";
import { buttonVariants } from "./button";

/**
 * Contract tests for the button token mapping (DESIGN.md §6). They assert the
 * design rules, not incidental class order.
 */
describe("buttonVariants", () => {
  it("cta is the 48 px conversion size with base text", () => {
    const classes = buttonVariants({ size: "cta" });
    expect(classes).toContain("h-12");
    expect(classes).toContain("px-6");
    expect(classes).toContain("text-base");
  });

  it("default (primary) uses navy tokens with a hover token, never an opacity hack", () => {
    const classes = buttonVariants({ variant: "default" });
    expect(classes).toContain("bg-primary");
    expect(classes).toContain("text-primary-foreground");
    expect(classes).toContain("hover:bg-primary-hover");
    expect(classes).not.toMatch(/bg-primary\/\d+/);
  });

  it("accent uses the azure tokens", () => {
    const classes = buttonVariants({ variant: "accent" });
    expect(classes).toContain("bg-accent");
    expect(classes).toContain("text-accent-foreground");
    expect(classes).toContain("hover:bg-accent-hover");
  });

  it("every variant carries the shared base: radius-md, semibold, disabled state, transition on colours only", () => {
    const variants = ["default", "accent", "outline", "secondary", "ghost", "destructive", "destructive-solid", "link"] as const;
    for (const variant of variants) {
      const classes = buttonVariants({ variant });
      expect(classes).toContain("disabled:pointer-events-none");
      expect(classes).toContain("font-semibold");
      expect(classes).toContain("transition-colors");
      expect(classes).not.toContain("transition-all");
    }
  });

  it("does not re-implement focus rings (the global :focus-visible outline applies)", () => {
    const classes = buttonVariants({ variant: "default" });
    expect(classes).not.toMatch(/focus-visible:ring/);
    expect(classes).not.toContain("outline-none");
  });

  it("destructive is tinted by default; the solid red is a separate opt-in variant", () => {
    expect(buttonVariants({ variant: "destructive" })).toContain("bg-danger-soft");
    expect(buttonVariants({ variant: "destructive-solid" })).toContain("bg-destructive");
  });
});
