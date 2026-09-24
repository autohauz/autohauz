import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EmailContact, EmailSegment } from "@/lib/domain";

type RawRow = Record<string, unknown>;

export const getEmailContacts = unstable_cache(
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

    const contacts = ((data ?? []) as RawRow[]).map((c) => ({
      id: c.id,
      email: c.email,
      firstName: c.first_name,
      lastName: c.last_name,
      phone: c.phone,
      location: c.location,
      tags: c.tags,
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
  { tags: ["email_contacts"] }, // Admin data, don't heavily cache
);

export const getEmailSegments = unstable_cache(
  async (): Promise<EmailSegment[]> => {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("email_segments")
      .select("*")
      .order("name", { ascending: true });
      
    return ((data ?? []) as RawRow[]).map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      filters: s.filters,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    }));
  },
  ["email_segments"],
  { revalidate: 60, tags: ["email_segments"] },
);
