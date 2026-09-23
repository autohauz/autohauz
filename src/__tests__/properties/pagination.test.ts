// Property: the page-number window always contains the ends and the current page, in order, with gaps marked.

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { PBT_CONFIG } from "./setup";
import { pageWindow } from "@/lib/pagination";

const pagesArb = fc.integer({ min: 1, max: 500 }).chain((total) => fc.tuple(fc.integer({ min: 1, max: total }), fc.constant(total)));

describe("pageWindow", () => {
  it("includes page 1, the last page and the current page for any valid position", () => {
    fc.assert(
      fc.property(pagesArb, ([page, total]) => {
        const numbers = pageWindow(page, total).filter((p): p is number => p !== null);
        expect(numbers).toContain(1);
        expect(numbers).toContain(total);
        expect(numbers).toContain(page);
      }),
      PBT_CONFIG,
    );
  });

  it("is strictly increasing, never repeats a page, and marks every jump with a gap", () => {
    fc.assert(
      fc.property(pagesArb, ([page, total]) => {
        const out = pageWindow(page, total);
        let prev: number | null = null;
        for (let i = 0; i < out.length; i++) {
          const item = out[i];
          if (item === null) {
            // A gap sits between two numbers and never at either end.
            expect(i).toBeGreaterThan(0);
            expect(i).toBeLessThan(out.length - 1);
            continue;
          }
          if (prev !== null) {
            expect(item).toBeGreaterThan(prev);
            if (item - prev > 1) expect(out[i - 1]).toBeNull();
            else expect(out[i - 1]).toBe(prev);
          }
          prev = item;
        }
      }),
      PBT_CONFIG,
    );
  });

  it("shows at most 2 + 2·radius + 1 numbers, so the control never overflows a phone", () => {
    fc.assert(
      fc.property(pagesArb, ([page, total]) => {
        const numbers = pageWindow(page, total).filter((p) => p !== null);
        expect(numbers.length).toBeLessThanOrEqual(5);
      }),
      PBT_CONFIG,
    );
  });

  it("matches hand-checked examples", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(5, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
    expect(pageWindow(2, 10)).toEqual([1, 2, 3, null, 10]);
    expect(pageWindow(10, 10)).toEqual([1, null, 9, 10]);
  });
});
