-- ─────────────────────────────────────────────────────────────────────────────
-- 0019  Newsletter: move "waitlist" pseudo-leads into newsletter_subscribers
--
-- Background: the footer newsletter form used to insert a `leads` row of type
-- 'waitlist' with name "Newsletter Subscriber" and phone "N/A". Those rows have
-- no enquiry and polluted the Admin → Leads pipeline. The API route now writes
-- to `newsletter_subscribers` (migration 0007), which was built for this.
--
-- This migration:
--   1. copies every waitlist lead's email into newsletter_subscribers
--      (idempotent — existing subscribers are left untouched);
--   2. deletes the migrated waitlist leads (and, via FK cascade, their
--      lead_events) so they disappear from the pipeline.
--
-- The 'waitlist' value stays in the public.lead_type enum: PostgreSQL cannot
-- drop an enum value in place, and recreating the type would require rewriting
-- every dependent column. The application no longer produces or displays it.
--
-- Rollback: the deleted rows are not recoverable from this file. Take a
-- snapshot (`select * from public.leads where type = 'waitlist'`) before
-- applying in production if an audit trail of the old rows is required.
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.newsletter_subscribers (email, consent_at, source, created_at)
select
  lower(l.email),
  l.created_at,
  coalesce(l.payload->>'source', 'footer'),
  l.created_at
from public.leads l
where l.type = 'waitlist'
  and l.email is not null
  and l.email <> ''
on conflict (email) do nothing;

delete from public.leads
where type = 'waitlist';
