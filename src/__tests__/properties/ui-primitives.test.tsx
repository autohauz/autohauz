/**
 * @vitest-environment jsdom
 */

// Feature: elite-ui-overhaul, Property 1: UI Primitive Rendering Resilience
// For any exported UI primitive with any valid prop combination, rendering
// SHALL succeed without error and produce at least one DOM element.
// **Validates: Requirements 1.4, 1.6**

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { render } from "@testing-library/react";
import React from "react";

import { PBT_CONFIG } from "./setup";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

// --- Arbitraries for component props ---

const buttonVariantArb = fc.constantFrom(
  "default",
  "outline",
  "secondary",
  "ghost",
  "destructive",
  "link"
) as fc.Arbitrary<
  "default" | "outline" | "secondary" | "ghost" | "destructive" | "link"
>;

const buttonSizeArb = fc.constantFrom(
  "default",
  "sm",
  "lg",
  "icon",
  "cta"
) as fc.Arbitrary<"default" | "sm" | "lg" | "icon" | "cta">;

const buttonPropsArb = fc.record({
  variant: buttonVariantArb,
  size: buttonSizeArb,
  disabled: fc.boolean(),
});

const cardVariantArb = fc.constantFrom(
  "default",
  "elevated",
  "interactive"
) as fc.Arbitrary<"default" | "elevated" | "interactive">;

const cardSizeArb = fc.constantFrom("default", "sm") as fc.Arbitrary<
  "default" | "sm"
>;

const cardPropsArb = fc.record({
  variant: cardVariantArb,
  size: cardSizeArb,
});

const badgeVariantArb = fc.constantFrom(
  "default",
  "neutral",
  "success",
  "warning",
  "danger",
  "info",
  "outline",
  "solid"
) as fc.Arbitrary<
  "default" | "neutral" | "success" | "warning" | "danger" | "info" | "outline" | "solid"
>;

const badgePropsArb = fc.record({
  variant: badgeVariantArb,
});

const inputTypeArb = fc.constantFrom(
  "text",
  "email",
  "password",
  "number",
  "tel",
  "url",
  "search"
);

const inputPropsArb = fc.record({
  type: inputTypeArb,
  disabled: fc.boolean(),
  placeholder: fc.string({ minLength: 0, maxLength: 30 }),
});

const skeletonVariantArb = fc.constantFrom(
  "text",
  "circular",
  "rectangular"
) as fc.Arbitrary<"text" | "circular" | "rectangular">;

const skeletonPropsArb = fc.record({
  variant: skeletonVariantArb,
});

// --- Property Tests ---

describe("Property 1: UI Primitive Rendering Resilience", () => {
  it("Button renders without error for any valid prop combination", () => {
    fc.assert(
      fc.property(buttonPropsArb, (props) => {
        const { container } = render(
          <Button variant={props.variant} size={props.size} disabled={props.disabled}>
            Button
          </Button>
        );
        expect(container.children.length).toBeGreaterThanOrEqual(1);
      }),
      PBT_CONFIG
    );
  });

  it("Card renders without error for any valid prop combination", () => {
    fc.assert(
      fc.property(cardPropsArb, (props) => {
        const { container } = render(
          <Card variant={props.variant} size={props.size}>
            <div>Card content</div>
          </Card>
        );
        expect(container.children.length).toBeGreaterThanOrEqual(1);
      }),
      PBT_CONFIG
    );
  });

  it("Badge renders without error for any valid prop combination", () => {
    fc.assert(
      fc.property(badgePropsArb, (props) => {
        const { container } = render(
          <Badge variant={props.variant}>Badge</Badge>
        );
        expect(container.children.length).toBeGreaterThanOrEqual(1);
      }),
      PBT_CONFIG
    );
  });

  it("Input renders without error for any valid prop combination", () => {
    fc.assert(
      fc.property(inputPropsArb, (props) => {
        const { container } = render(
          <Input
            type={props.type}
            disabled={props.disabled}
            placeholder={props.placeholder}
          />
        );
        expect(container.children.length).toBeGreaterThanOrEqual(1);
      }),
      PBT_CONFIG
    );
  });


  it("Skeleton renders without error for any valid prop combination", () => {
    fc.assert(
      fc.property(skeletonPropsArb, (props) => {
        const { container } = render(
          <Skeleton variant={props.variant} />
        );
        expect(container.children.length).toBeGreaterThanOrEqual(1);
      }),
      PBT_CONFIG
    );
  });
});
