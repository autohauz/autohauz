import "server-only";
import { requirePermission } from "@/lib/security/auth";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EmailContact, EmailSegment } from "@/lib/domain";

type ContactRow = {
  id: string; email: string; first_name: string | null; last_name: string | null; phone: string | null;
  location: string | null; tags: string[] | null; source: string | null;
  subscription_status: EmailContact["subscriptionStatus"]; consent_given: boolean; consent_at: string | null;
  last_sent_at: string | null; last_opened_at: string | null; last_clicked_at: string | null;
  created_at: string; updated_at: string;
};

type SegmentRow = {
  id: string; name: string; description: string | null; filters: Record<string, unknown> | null;
  created_at: string; updated_at: string;
};

const cached_getEmailContacts = unstable_cache(
  async (
    options: {
      status?: EmailContact["subscriptionStatus"];
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ data: EmailContact[]; count: number }> => {
    const supabase = createAdminClient();
    
    let countQuery = supabase.from("email_contacts").select("*", { count: "exact", head: true });
    let query = supabase.from("email_contacts").select("*").order("created_at", { ascending: false });

    if (options.status) {
      countQuery = countQuery.eq("subscription_status", options.status);
      query = query.eq("subscription_status", options.status);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }
    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const [{ count }, { data, error }] = await Promise.all([countQuery, query]);
    
    if (error) console.error("Error fetching email contacts:", error);

    const contacts = ((data ?? []) as ContactRow[]).map((c): EmailContact => ({
      id: c.id,
      email: c.email,
      firstName: c.first_name,
      lastName: c.last_name,
      phone: c.phone,
      location: c.location,
      tags: c.tags ?? [],
      source: c.source,
      subscriptionStatus: c.subscription_status,
      consentGiven: c.consent_given,
      consentAt: c.consent_at,
      lastSentAt: c.last_sent_at,
      lastOpenedAt: c.last_opened_at,
      lastClickedAt: c.last_clicked_at,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));

    return { data: contacts, count: count ?? 0 };
  },
  ["email_contacts"],
  { revalidate: 60, tags: ["email_contacts"] },
);

const cached_getEmailSegments = unstable_cache(
  async (): Promise<EmailSegment[]> => {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("email_segments")
      .select("*")
      .order("name", { ascending: true });
      
    return ((data ?? []) as SegmentRow[]).map((s): EmailSegment => ({
      id: s.id,
      name: s.name,
      description: s.description,
      filters: s.filters ?? {},
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    }));
  },
  ["email_segments"],
  { revalidate: 60, tags: ["email_segments"] },
);

/** Staff-only: authorization is checked outside the cache on every call. */
export async function getEmailContacts(...args: Parameters<typeof cached_getEmailContacts>) {
  await requirePermission("email.view");
  return cached_getEmailContacts(...args);
}

/** Staff-only: authorization is checked outside the cache on every call. */
export async function getEmailSegments(...args: Parameters<typeof cached_getEmailSegments>) {
  await requirePermission("email.view");
  return cached_getEmailSegments(...args);
}

/**
 * Approximate audience per segment ("" = all subscribers): confirmed,
 * consented contacts matching the segment's filters. The exact list is
 * snapshotted (and suppression-checked) when the campaign starts.
 */
export async function getAudienceSizes(segments: { id: string; filters: Record<string, unknown> }[]): Promise<Record<string, number>> {
  await requirePermission("email.view");
  const supabase = createAdminClient();
  const base = () =>
    supabase
      .from("email_contacts")
      .select("id", { count: "exact", head: true })
      .eq("subscription_status", "subscribed")
      .eq("consent_given", true);

  const entries = await Promise.all([
    base().then(({ count }) => ["", count ?? 0] as const),
    ...segments.map(async (s) => {
      let q = base();
      const tags = Array.isArray(s.filters.tags) ? (s.filters.tags as string[]) : [];
      if (tags.length) q = q.overlaps("tags", tags);
      if (typeof s.filters.source === "string") q = q.eq("source", s.filters.source);
      const { count } = await q;
      return [s.id, count ?? 0] as const;
    }),
  ]);
  return Object.fromEntries(entries);
}
