// Property: every empty state carries an icon, a heading, a message, and a CTA.
// @vitest-environment jsdom

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { render } from "@testing-library/react";
import { PBT_CONFIG } from "./setup";
import { EmptyState } from "@/components/ui/empty-state";

// Each run mounts a React tree; 25 runs keeps the file well inside Vitest's per-test timeout on a cold jsdom.
const RENDER_RUNS = { ...PBT_CONFIG, numRuns: 25 };

const text = (max: number) => fc.string({ minLength: 1, maxLength: max }).filter((s) => s.trim().length > 0);

const hrefArb = fc.constantFrom("/used-cars", "/", "/contact", "/admin/invoices/new");

describe("EmptyState", () => {
  it("renders icon, heading, message, and a link CTA for any valid props", () => {
    fc.assert(
      fc.property(fc.record({ title: text(100), description: text(200), label: text(50), href: hrefArb }), (p) => {
        const { container } = render(
          <EmptyState title={p.title} description={p.description} action={{ label: p.label, href: p.href }} />,
        );
        expect(container.querySelector("svg")).not.toBeNull();
        expect(container.querySelector("h2")!.textContent).toBe(p.title);
        expect(container.querySelector("p")!.textContent).toBe(p.description);
        const link = container.querySelector("a")!;
        expect(link.getAttribute("href")).toBe(p.href);
        expect(link.textContent).toBe(p.label);
        // A link is never nested inside a button or vice versa.
        expect(container.querySelector("a button, button a")).toBeNull();
      }),
      RENDER_RUNS,
    );
  });

  it("renders a button CTA when given an onClick action", () => {
    fc.assert(
      fc.property(fc.record({ title: text(100), description: text(200), label: text(50) }), (p) => {
        const { container } = render(
          <EmptyState title={p.title} description={p.description} action={{ label: p.label, onClick: () => {} }} />,
        );
        const button = container.querySelector("button")!;
        expect(button).not.toBeNull();
        expect(button.textContent).toBe(p.label);
        expect(button.getAttribute("type")).toBe("button");
      }),
      RENDER_RUNS,
    );
  });

  it("renders the requested heading level", () => {
    const { container } = render(<EmptyState title="Inside a section" description="…" headingLevel="h3" />);
    expect(container.querySelector("h3")!.textContent).toBe("Inside a section");
    expect(container.querySelector("h2")).toBeNull();
  });

  it("renders no CTA row when no action is given", () => {
    const { container } = render(<EmptyState title="Nothing here" description="Add something." />);
    expect(container.querySelector("a, button")).toBeNull();
    expect(container.querySelector("h2")!.textContent).toBe("Nothing here");
  });
});
