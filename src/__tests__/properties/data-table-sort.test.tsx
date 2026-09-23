// @vitest-environment jsdom
// Feature: elite-ui-overhaul, Property 7: Data Table Sort Ordering

/**
 * Property Test: Data Table Sort Ordering
 *
 * For any data table with N rows and for any sortable column, when sort is
 * applied in ascending order, each row's value for that column SHALL be ≤ the
 * next row's value. When sort is applied in descending order, each row's value
 * SHALL be ≥ the next row's value.
 *
 * **Validates: Requirements 8.3, 9.3**
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { render, fireEvent } from "@testing-library/react";
import { PBT_CONFIG } from "./setup";
import { DataTable } from "@/components/data-table";
import type { DataTableColumn } from "@/components/data-table";

// ─── Arbitraries ─────────────────────────────────────────────────────────────

interface TestRow extends Record<string, unknown> {
  name: string;
  age: number;
  city: string;
  score: number;
}

/**
 * Generates a random row of data with string and numeric fields.
 */
const testRowArb: fc.Arbitrary<TestRow> = fc.record({
  name: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
  age: fc.integer({ min: 0, max: 120 }),
  city: fc.constantFrom("Perth", "Sydney", "Melbourne", "Brisbane", "Adelaide"),
  score: fc.integer({ min: 0, max: 1000 }),
});

/**
 * Generates a non-empty array of test rows (1 to 50 rows).
 * We keep it reasonable for rendering performance.
 */
const testDataArb: fc.Arbitrary<TestRow[]> = fc.array(testRowArb, {
  minLength: 1,
  maxLength: 50,
});

/**
 * Generates a sortable column key from the available columns.
 */
const sortableColumnKeyArb: fc.Arbitrary<keyof TestRow> = fc.constantFrom(
  "name",
  "age",
  "city",
  "score"
);

// ─── Test Columns Definition ─────────────────────────────────────────────────

const TEST_COLUMNS: DataTableColumn<TestRow>[] = [
  { key: "name", label: "Name", sortable: true },
  { key: "age", label: "Age", sortable: true },
  { key: "city", label: "City", sortable: true },
  { key: "score", label: "Score", sortable: true },
];

// ─── Helper: Extract cell values from rendered table ─────────────────────────

function getColumnValues(container: HTMLElement, columnIndex: number): string[] {
  const rows = container.querySelectorAll("tbody tr");
  const values: string[] = [];
  rows.forEach((row) => {
    const cells = row.querySelectorAll("td");
    if (cells[columnIndex]) {
      values.push(cells[columnIndex].textContent || "");
    }
  });
  return values;
}

/**
 * Checks that string values are in ascending order using localeCompare.
 */
function isAscendingStrings(values: string[]): boolean {
  for (let i = 0; i < values.length - 1; i++) {
    if (values[i].localeCompare(values[i + 1]) > 0) {
      return false;
    }
  }
  return true;
}

/**
 * Checks that string values are in descending order using localeCompare.
 */
function isDescendingStrings(values: string[]): boolean {
  for (let i = 0; i < values.length - 1; i++) {
    if (values[i].localeCompare(values[i + 1]) < 0) {
      return false;
    }
  }
  return true;
}

/**
 * Checks that numeric values are in ascending order.
 */
function isAscendingNumbers(values: number[]): boolean {
  for (let i = 0; i < values.length - 1; i++) {
    if (values[i] > values[i + 1]) {
      return false;
    }
  }
  return true;
}

/**
 * Checks that numeric values are in descending order.
 */
function isDescendingNumbers(values: number[]): boolean {
  for (let i = 0; i < values.length - 1; i++) {
    if (values[i] < values[i + 1]) {
      return false;
    }
  }
  return true;
}

// ─── Property Tests ──────────────────────────────────────────────────────────

describe("Property 7: Data Table Sort Ordering", () => {
  it("ascending sort ensures each value ≤ next for any data array and sortable column", () => {
    fc.assert(
      fc.property(testDataArb, sortableColumnKeyArb, (data, columnKey) => {
        const columnIndex = TEST_COLUMNS.findIndex((c) => c.key === columnKey);

        // Render with a large page size to show all rows without pagination
        const { container, unmount } = render(
          <DataTable
            columns={TEST_COLUMNS}
            data={data}
            pageSize={data.length}
          />
        );

        // Click the sortable column header to trigger ascending sort
        const headerCells = container.querySelectorAll("th");
        fireEvent.click(headerCells[columnIndex]);

        // Extract column values from the rendered table
        const values = getColumnValues(container, columnIndex);

        // Verify ascending order
        if (columnKey === "age" || columnKey === "score") {
          // Numeric columns
          const numericValues = values.map(Number);
          expect(isAscendingNumbers(numericValues)).toBe(true);
        } else {
          // String columns
          expect(isAscendingStrings(values)).toBe(true);
        }

        unmount();
      }),
      PBT_CONFIG
    );
  }, 20000);

  it("descending sort ensures each value ≥ next for any data array and sortable column", () => {
    fc.assert(
      fc.property(testDataArb, sortableColumnKeyArb, (data, columnKey) => {
        const columnIndex = TEST_COLUMNS.findIndex((c) => c.key === columnKey);

        // Render with a large page size to show all rows without pagination
        const { container, unmount } = render(
          <DataTable
            columns={TEST_COLUMNS}
            data={data}
            pageSize={data.length}
          />
        );

        // Click header once for ascending, then again for descending
        const headerCells = container.querySelectorAll("th");
        fireEvent.click(headerCells[columnIndex]); // ascending
        fireEvent.click(headerCells[columnIndex]); // descending

        // Extract column values from the rendered table
        const values = getColumnValues(container, columnIndex);

        // Verify descending order
        if (columnKey === "age" || columnKey === "score") {
          // Numeric columns
          const numericValues = values.map(Number);
          expect(isDescendingNumbers(numericValues)).toBe(true);
        } else {
          // String columns
          expect(isDescendingStrings(values)).toBe(true);
        }

        unmount();
      }),
      PBT_CONFIG
    );
  }, 20000);
});
