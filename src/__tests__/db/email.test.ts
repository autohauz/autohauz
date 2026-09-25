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

async function request(email: string, source = "footer") {
  const { rows } = await db.query<{ contact_id: string | null; outcome: string }>(
    "select * from public.subscribe_request($1, $2, 'iphash')",
    [email, source],
  );
  return rows[0];
}
const confirm = async (id: string) =>
  (await db.query<{ email: string | null }>("select public.confirm_subscription($1) as email", [id])).rows[0].email;
const contact = async (email: string) =>
  (await db.query<{ subscription_status: string; consent_given: boolean }>(
    "select subscription_status, consent_given from email_contacts where email = $1",
    [email],
  )).rows[0];

async function subscribed(email: string, tags: string[] = []) {
  const r = await request(email);
  await confirm(r.contact_id!);
  if (tags.length) await db.query("update email_contacts set tags = $2 where email = $1", [email, tags]);
}

async function campaign(segmentFilters?: Record<string, unknown>): Promise<string> {
  const { rows: t } = await db.query<{ id: string }>(
    "insert into email_templates (name, subject, html_body) values ('t', 's', '<p>x</p>') returning id",
  );
  let segmentId: string | null = null;
  if (segmentFilters) {
    const { rows } = await db.query<{ id: string }>(
      "insert into email_segments (name, filters) values ('seg', $1) returning id",
      [JSON.stringify(segmentFilters)],
    );
    segmentId = rows[0].id;
  }
  const { rows } = await db.query<{ id: string }>(
    "insert into email_campaigns (name, subject, template_id, segment_id) values ('c', 's', $1, $2) returning id",
    [t[0].id, segmentId],
  );
  return rows[0].id;
}

describe("double opt-in", () => {
  it("never subscribes on request; only after confirmation", async () => {
    const r = await request("New@Example.com");
    expect(r.outcome).toBe("confirm");
    expect(await contact("new@example.com")).toEqual({ subscription_status: "pending", consent_given: false });
    expect(await confirm(r.contact_id!)).toBe("new@example.com");
    expect(await contact("new@example.com")).toEqual({ subscription_status: "subscribed", consent_given: true });
    expect((await request("new@example.com")).outcome).toBe("already_subscribed");
  });

  it("does not silently re-subscribe an unsubscribed address", async () => {
    await subscribed("gone@example.com");
    const { rows } = await db.query<{ id: string }>("select id from email_contacts where email = 'gone@example.com'");
    await db.query("select public.unsubscribe_email_contact($1, null)", [rows[0].id]);

    const again = await request("gone@example.com");
    expect(again.outcome).toBe("confirm");
    expect((await contact("gone@example.com")).subscription_status).toBe("unsubscribed");

    // Only the confirmed link re-subscribes (and lifts the voluntary suppression).
    await confirm(again.contact_id!);
    expect((await contact("gone@example.com")).subscription_status).toBe("subscribed");
  });

  it("never re-subscribes hard bounces or complaints", async () => {
    await db.query("insert into email_suppressions (email, reason) values ('bounced@example.com', 'hard_bounce')");
    expect((await request("bounced@example.com")).outcome).toBe("blocked");
  });
});

describe("suppression guard", () => {
  it("refuses to mark a suppressed address subscribed by any path", async () => {
    await db.query("insert into email_suppressions (email, reason) values ('sup@example.com', 'manual')");
    await expect(
      db.query("insert into email_contacts (email, subscription_status, consent_given) values ('SUP@example.com', 'subscribed', true)"),
    ).rejects.toThrow(/suppression list/);
  });
});

describe("unsubscribe", () => {
  it("is idempotent and writes the suppression list and campaign counter once", async () => {
    await subscribed("u@example.com");
    const id = (await db.query<{ id: string }>("select id from email_contacts where email = 'u@example.com'")).rows[0].id;
    const c = await campaign();
    await db.query("select public.unsubscribe_email_contact($1, $2)", [id, c]);
    await db.query("select public.unsubscribe_email_contact($1, $2)", [id, c]);
    const sup = await db.query("select reason from email_suppressions where email = 'u@example.com'");
    expect(sup.rows).toEqual([{ reason: "unsubscribed" }]);
    const { rows } = await db.query<{ n: number }>("select unsubscribed_count as n from email_campaigns where id = $1", [c]);
    expect(rows[0].n).toBe(1);
  });
});

describe("campaign queue", () => {
  it("targets only consented, non-suppressed contacts in the segment, once", async () => {
    await subscribed("toyota1@example.com", ["toyota"]);
    await subscribed("toyota2@example.com", ["toyota", "suv"]);
    await subscribed("ford@example.com", ["ford"]);
    await request("pending@example.com"); // never confirmed
    await subscribed("toyota-unsub@example.com", ["toyota"]);
    const u = (await db.query<{ id: string }>("select id from email_contacts where email = 'toyota-unsub@example.com'")).rows[0].id;
    await db.query("select public.unsubscribe_email_contact($1, null)", [u]);

    const c = await campaign({ tags: ["toyota"] });
    const n = (await db.query<{ n: number }>("select public.start_email_campaign($1) as n", [c])).rows[0].n;
    expect(n).toBe(2);
    await expect(db.query("select public.start_email_campaign($1)", [c])).rejects.toThrow(/Only draft or scheduled/);
    const { rows } = await db.query<{ email: string }>("select email from email_campaign_sends where campaign_id = $1 order by email", [c]);
    expect(rows.map((r) => r.email)).toEqual(["toyota1@example.com", "toyota2@example.com"]);
  });

  it("hands out each send once and finishes when drained", async () => {
    await subscribed("a@q.example");
    await subscribed("b@q.example");
    const c = await campaign({ source: "footer" });
    const total = (await db.query<{ n: number }>("select public.start_email_campaign($1) as n", [c])).rows[0].n;

    const first = await db.query<{ send_id: string }>("select * from public.claim_email_sends($1, 1)", [c]);
    const second = await db.query<{ send_id: string }>("select * from public.claim_email_sends($1, 1000)", [c]);
    const claimed = [...first.rows, ...second.rows].map((r) => r.send_id);
    expect(new Set(claimed).size).toBe(claimed.length);
    expect(claimed.length).toBe(total);

    expect((await db.query<{ done: boolean }>("select public.finish_email_campaign($1) as done", [c])).rows[0].done).toBe(false);
    await db.query("update email_campaign_sends set status = 'sent', sent_at = now() where campaign_id = $1", [c]);
    expect((await db.query<{ done: boolean }>("select public.finish_email_campaign($1) as done", [c])).rows[0].done).toBe(true);
    const { rows } = await db.query<{ status: string; sent_count: number }>(
      "select status, sent_count from email_campaigns where id = $1",
      [c],
    );
    expect(rows[0]).toEqual({ status: "sent", sent_count: total });
  });

  it("refuses to start a campaign with no content", async () => {
    const { rows } = await db.query<{ id: string }>("insert into email_campaigns (name, subject) values ('x', 'y') returning id");
    await expect(db.query("select public.start_email_campaign($1)", [rows[0].id])).rejects.toThrow(/Choose a template/);
  });
});
