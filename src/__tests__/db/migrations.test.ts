import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { asRole, createDatabase, createUser, grantStaffRole, migrationFiles, MIGRATIONS_DIR } from "./harness";

let db: PGlite;

beforeAll(async () => {
  db = await createDatabase();
}, 120_000);

afterAll(async () => {
  await db?.close();
});

describe("migrations", () => {
  it("apply cleanly, in CLI order", () => {
    const files = migrationFiles();
    expect(files[0]).toMatch(/^0001_/);
    // The date-stamped files must sort after every 00NN_ file.
    const firstDated = files.findIndex((f) => /^\d{8}/.test(f));
    expect(files.slice(firstDated).every((f) => /^\d{8}/.test(f))).toBe(true);
  });
});

describe("SEC-01: privileged RPCs are not executable by anon/authenticated", () => {
  const privileged = [
    "public.anonymize_stale_leads(integer)",
    "public.create_lead_with_event(jsonb)",
    "public.next_invoice_number(text)",
    "public.expire_stale_vdps()",
    "public.increment_vehicle_view(uuid)",
    "public.record_cta_click(uuid, text)",
    "public.publish_scheduled_articles()",
  ];

  it.each(privileged)("%s", async (fn) => {
    const { rows } = await db.query<{ anon: boolean; authed: boolean; svc: boolean }>(
      `select has_function_privilege('anon', $1, 'execute') as anon,
              has_function_privilege('authenticated', $1, 'execute') as authed,
              has_function_privilege('service_role', $1, 'execute') as svc`,
      [fn],
    );
    expect(rows[0]).toEqual({ anon: false, authed: false, svc: true });
  });

  it("anon calling anonymize_stale_leads is refused", async () => {
    await expect(asRole(db, "anon", null, () => db.query("select public.anonymize_stale_leads(0)"))).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe("SEC-07: users cannot rewrite their own profile identity", () => {
  it("keeps email fixed on a self-update", async () => {
    const id = await createUser(db, "victim-target@example.com");
    await asRole(db, "authenticated", id, () =>
      db.query("update public.profiles set email = 'someone-else@example.com', full_name = 'X' where id = $1", [id]),
    );
    const { rows } = await db.query<{ email: string; full_name: string }>(
      "select email, full_name from public.profiles where id = $1",
      [id],
    );
    expect(rows[0]).toEqual({ email: "victim-target@example.com", full_name: "X" });
  });
});

describe("staff role guard", () => {
  it("stops an admin from promoting themselves or anyone to owner", async () => {
    const admin = await createUser(db, "admin@example.com");
    const other = await createUser(db, "other@example.com");
    await grantStaffRole(db, admin, "admin");

    await expect(
      asRole(db, "authenticated", admin, () =>
        db.query("insert into public.admin_roles (user_id, role) values ($1, 'owner')", [other]),
      ),
    ).rejects.toThrow(/Only an owner/);

    await expect(
      asRole(db, "authenticated", admin, () =>
        db.query("update public.admin_roles set role = 'owner' where user_id = $1", [admin]),
      ),
    ).rejects.toThrow(/Only an owner|cannot change their own role/);
  });

  it("lets an owner grant non-owner roles", async () => {
    const owner = await createUser(db, "owner@example.com");
    const sales = await createUser(db, "sales@example.com");
    await grantStaffRole(db, owner, "owner");
    await asRole(db, "authenticated", owner, () =>
      db.query("insert into public.admin_roles (user_id, role) values ($1, 'sales')", [sales]),
    );
    const { rows } = await db.query("select role from public.admin_roles where user_id = $1", [sales]);
    expect(rows).toEqual([{ role: "sales" }]);
  });
});

describe("DB-19: audit log is append-only", () => {
  it("rejects update and delete even for the service role", async () => {
    await db.query("insert into public.activity_logs (action, entity_type) values ('t', 'test')");
    await expect(db.query("update public.activity_logs set action = 'x'")).rejects.toThrow(/append-only/);
    await expect(db.query("delete from public.activity_logs")).rejects.toThrow(/append-only/);
  });
});

describe("SEC-17: retired buyer tables are not writable by end users", () => {
  it("refuses a bid insert from an authenticated user", async () => {
    const buyer = await createUser(db, "buyer@example.com");
    await expect(
      asRole(db, "authenticated", buyer, () =>
        db.query(
          "insert into public.bids (vehicle_id, buyer_id, amount) values (gen_random_uuid(), $1, 1)",
          [buyer],
        ),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("DB-17: marketing consent", () => {
  it("defaults new contacts to pending", async () => {
    const { rows } = await db.query<{ subscription_status: string }>(
      "insert into public.email_contacts (email) values ('new@example.com') returning subscription_status",
    );
    expect(rows[0].subscription_status).toBe("pending");
  });

  it("refuses 'subscribed' without consent", async () => {
    await expect(
      db.query(
        "insert into public.email_contacts (email, subscription_status, consent_given) values ('x@example.com', 'subscribed', false)",
      ),
    ).rejects.toThrow(/subscribed_requires_consent/);
  });
});

describe("DB-31: vehicle slugs are URL-safe", () => {
  const MIGRATION = "20260924100300_vehicle_slug_hygiene.sql";

  async function insertVehicle(slug: string, stock: string): Promise<string> {
    const { rows } = await db.query<{ id: string }>(
      `with mk as (
         insert into public.makes (name, slug) values ('Mitsubishi ' || $2, 'mitsubishi-' || lower($2)) returning id
       ), md as (
         insert into public.models (make_id, name, slug) select id, 'Pajero Sport', 'pajero-sport' from mk returning id, make_id
       )
       insert into public.vehicles (stock_id, slug, make_id, model_id, year, mileage_km, fuel_type, transmission, body_type, price)
       select $2, $1, md.make_id, md.id, 2019, 90000, 'diesel', 'automatic', 'suv', 39990 from md
       returning id`,
      [slug, stock],
    );
    return rows[0].id;
  }

  it("rejects a slug with a space", async () => {
    await expect(insertVehicle("2019-mitsubishi-pajero sport-gls-x1", "X1")).rejects.toThrow(/vehicles_slug_format/);
  });

  it("repairs existing bad slugs and keeps the old URL working", async () => {
    await db.query("alter table public.vehicles drop constraint vehicles_slug_format");
    const id = await insertVehicle("2019-mitsubishi-pajero sport-gls-x2", "X2");

    await db.exec(readFileSync(join(MIGRATIONS_DIR, MIGRATION), "utf8"));

    const { rows } = await db.query<{ slug: string }>("select slug from public.vehicles where id = $1", [id]);
    expect(rows[0].slug).toBe("2019-mitsubishi-pajero-sport-gls-x2");
    const { rows: redirects } = await db.query<{ to_path: string; code: number }>(
      "select to_path, code from public.redirects where from_path = $1",
      ["/used-cars/mitsubishi-x2/pajero-sport/2019-mitsubishi-pajero sport-gls-x2"],
    );
    expect(redirects).toEqual([{ to_path: "/used-cars/mitsubishi-x2/pajero-sport/2019-mitsubishi-pajero-sport-gls-x2", code: 301 }]);

    // Re-running is a no-op and the constraint is back.
    await db.exec(readFileSync(join(MIGRATIONS_DIR, MIGRATION), "utf8"));
    await expect(insertVehicle("Bad Slug", "X3")).rejects.toThrow(/vehicles_slug_format/);
  });
});

describe("default syndication dealer is AutoHauz", () => {
  it("is seeded as AutoHauz on a fresh database", async () => {
    const { rows } = await db.query<{ code: string; display_name: string }>(
      "select code, display_name from public.syndication_dealer where is_default",
    );
    expect(rows).toEqual([{ code: "autohauz", display_name: "AutoHauz" }]);
  });

  it("renames any older default dealer when 0021 runs", async () => {
    await db.query("update public.syndication_dealer set code = 'legacy', display_name = 'Legacy' where is_default");
    await db.exec(readFileSync(join(MIGRATIONS_DIR, "0021_rename_default_dealer.sql"), "utf8"));
    const { rows } = await db.query<{ code: string; display_name: string }>(
      "select code, display_name from public.syndication_dealer where is_default",
    );
    expect(rows).toEqual([{ code: "autohauz", display_name: "AutoHauz" }]);
  });
});
