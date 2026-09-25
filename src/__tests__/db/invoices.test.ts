import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDatabase } from "./harness";

let db: PGlite;

beforeAll(async () => {
  db = await createDatabase();
}, 120_000);

afterAll(async () => {
  await db?.close();
});

const header = (overrides: Record<string, unknown> = {}) => ({
  billing_name: "Jane Buyer",
  billing_email: "jane@example.com",
  gst_enabled: true,
  gst_rate: 10,
  prices_include_gst: true,
  subtotal_cents: 1100000,
  line_discounts_cents: 0,
  invoice_discount_cents: 0,
  net_ex_gst_cents: 1000000,
  gst_cents: 100000,
  gst_free_cents: 0,
  total_inc_gst_cents: 1100000,
  ...overrides,
});

const items = [{ description: "2019 Toyota Corolla", quantity: 1, unit_price_cents: 1100000, discount_cents: 0 }];

async function draft(h = header(), it: unknown[] = items): Promise<string> {
  const { rows } = await db.query<{ id: string }>("select public.save_invoice_draft(null, $1, $2) as id", [
    JSON.stringify(h),
    JSON.stringify(it),
  ]);
  return rows[0].id;
}

async function issue(id: string): Promise<string> {
  const { rows } = await db.query<{ n: string }>(
    "select public.issue_invoice($1, 'AH', 'Tax Invoice', $2, $3) as n",
    [id, JSON.stringify({ legalName: "AutoHauz Pty Ltd", abn: "51824753556" }), JSON.stringify({ vin: "X" })],
  );
  return rows[0].n;
}

const status = async (id: string) =>
  (await db.query<{ status: string; payments_cents: number }>(
    "select status, payments_cents::int as payments_cents from invoices where id = $1",
    [id],
  )).rows[0];

describe("save_invoice_draft", () => {
  it("creates a draft with its items in one call", async () => {
    const id = await draft();
    const { rows } = await db.query("select count(*)::int as n from invoice_items where invoice_id = $1", [id]);
    expect(rows[0]).toEqual({ n: 1 });
    expect((await status(id)).status).toBe("draft");
  });

  it("replaces items on update and stores the GST-free flag", async () => {
    const id = await draft();
    await db.query("select public.save_invoice_draft($1, $2, $3)", [
      id,
      JSON.stringify(header()),
      JSON.stringify([...items, { description: "Rego", quantity: 1, unit_price_cents: 80000, discount_cents: 0, gst_applicable: false }]),
    ]);
    const { rows } = await db.query<{ description: string; gst_applicable: boolean }>(
      "select description, gst_applicable from invoice_items where invoice_id = $1 order by sort_order",
      [id],
    );
    expect(rows).toEqual([
      { description: "2019 Toyota Corolla", gst_applicable: true },
      { description: "Rego", gst_applicable: false },
    ]);
  });

  it("rolls back entirely when an item is invalid (no orphan header)", async () => {
    const before = (await db.query<{ n: number }>("select count(*)::int as n from invoices")).rows[0].n;
    await expect(draft(header(), [{ description: "bad", quantity: 0, unit_price_cents: 1 }])).rejects.toThrow(
      /invoice_items_values_check/,
    );
    const after = (await db.query<{ n: number }>("select count(*)::int as n from invoices")).rows[0].n;
    expect(after).toBe(before);
  });
});

describe("issue_invoice", () => {
  it("numbers the invoice, freezes the seller snapshot and uses the Sydney year", async () => {
    const id = await draft();
    const number = await issue(id);
    const sydneyYear = (await db.query<{ y: number }>("select extract(year from now() at time zone 'Australia/Sydney')::int as y"))
      .rows[0].y;
    expect(number).toMatch(new RegExp(`^AH-${sydneyYear}-\\d{6}$`));
    const { rows } = await db.query<{ status: string; seller: { abn: string }; title: string }>(
      "select status, seller_snapshot as seller, document_title as title from invoices where id = $1",
      [id],
    );
    expect(rows[0]).toMatchObject({ status: "issued", seller: { abn: "51824753556" }, title: "Tax Invoice" });
  });

  it("refuses to issue twice (no renumbering)", async () => {
    const id = await draft();
    const first = await issue(id);
    await expect(issue(id)).rejects.toThrow(/Only draft invoices can be issued/);
    const { rows } = await db.query<{ n: string }>("select invoice_number as n from invoices where id = $1", [id]);
    expect(rows[0].n).toBe(first);
  });

  it("refuses an invoice with no items or a zero total", async () => {
    await expect(issue(await draft(header(), []))).rejects.toThrow(/at least one line item/);
    await expect(
      issue(await draft(header({ total_inc_gst_cents: 0, subtotal_cents: 0, net_ex_gst_cents: 0, gst_cents: 0 }), [
        { description: "free", quantity: 1, unit_price_cents: 0, discount_cents: 0 },
      ])),
    ).rejects.toThrow(/greater than zero/);
  });

  it("rejects an unsafe number prefix", async () => {
    await expect(db.query("select public.next_invoice_number('A-B')")).rejects.toThrow(/Invalid invoice number prefix/);
  });
});

describe("immutability of issued invoices", () => {
  it("blocks edits to money, billing and items, and blocks deletion", async () => {
    const id = await draft();
    await issue(id);
    await expect(db.query("update invoices set total_inc_gst_cents = 1 where id = $1", [id])).rejects.toThrow(
      /cannot be edited/,
    );
    await expect(db.query("update invoices set billing_name = 'X' where id = $1", [id])).rejects.toThrow(
      /cannot be edited/,
    );
    await expect(db.query("update invoice_items set unit_price_cents = 1 where invoice_id = $1", [id])).rejects.toThrow(
      /cannot be changed/,
    );
    await expect(
      db.query("select public.save_invoice_draft($1, $2, $3)", [id, JSON.stringify(header()), JSON.stringify(items)]),
    ).rejects.toThrow(/Only draft invoices can be edited/);
    await expect(db.query("delete from invoices where id = $1", [id])).rejects.toThrow(/cannot be deleted/);
  });

  it("still allows a draft to be deleted with its items", async () => {
    const id = await draft();
    await db.query("delete from invoices where id = $1", [id]);
    const { rows } = await db.query("select count(*)::int as n from invoice_items where invoice_id = $1", [id]);
    expect(rows[0]).toEqual({ n: 0 });
  });
});

describe("payments", () => {
  const pay = (id: string, cents: number) =>
    db.query(
      "insert into invoice_payments (invoice_id, amount_cents, payment_date, payment_method) values ($1, $2, current_date, 'eft')",
      [id, cents],
    );

  it("moves issued → partially_paid → paid", async () => {
    const id = await draft();
    await issue(id);
    await pay(id, 100000);
    expect(await status(id)).toEqual({ status: "partially_paid", payments_cents: 100000 });
    await pay(id, 1000000);
    expect(await status(id)).toEqual({ status: "paid", payments_cents: 1100000 });
  });

  it("refuses overpayment, payment on drafts and payment on void invoices", async () => {
    const id = await draft();
    await issue(id);
    await expect(pay(id, 1100001)).rejects.toThrow(/exceeds the balance/);

    const d = await draft();
    await expect(pay(d, 100)).rejects.toThrow(/only be recorded against issued/);

    const v = await draft();
    await issue(v);
    await db.query("update invoices set status = 'void', voided_at = now() where id = $1", [v]);
    await expect(pay(v, 100)).rejects.toThrow(/only be recorded against issued/);
  });

  it("keeps recorded payments append-only", async () => {
    const id = await draft();
    await issue(id);
    await pay(id, 500);
    await expect(db.query("update invoice_payments set amount_cents = 1 where invoice_id = $1", [id])).rejects.toThrow(
      /cannot be changed/,
    );
    await expect(db.query("delete from invoice_payments where invoice_id = $1", [id])).rejects.toThrow(
      /cannot be changed/,
    );
  });
});
