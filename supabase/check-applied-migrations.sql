-- READ-ONLY. Paste into Supabase → SQL Editor → Run.
-- Shows which migration files are already present in this database
-- (the schema was created by pasting SQL, so the CLI history is empty).

select m.version, m.present
from (values
  ('0001', to_regtype('public.staff_role') is not null),
  ('0002', to_regclass('public.activity_logs') is not null),
  ('0003', to_regclass('public.features') is not null),
  ('0004', to_regclass('public.vehicles') is not null),
  ('0005', to_regclass('public.lead_reminders') is not null),
  ('0006', to_regclass('public.pages') is not null),
  ('0007', to_regclass('public.search_index_jobs') is not null),
  ('0008', exists (select 1 from storage.buckets where id = 'media')),
  ('0009', to_regproc('public.anonymize_stale_leads') is not null),
  ('0010', exists (select 1 from public.settings where key = 'company_profile')),
  ('0011', to_regclass('public.blog_articles') is not null),
  ('0012', to_regclass('public.chat_messages') is not null),
  ('0013', not exists (select 1 from pg_constraint where conname = 'search_index_jobs_vehicle_id_fkey')),
  ('0014', to_regclass('public.syndication_dealer') is not null),
  ('0015', to_regclass('public.channel_connection') is not null),
  ('0016', to_regtype('public.media_processing_status') is not null),
  ('0017', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'leads' and column_name = 'channel_lead_id')),
  ('0018', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'syndication_vehicle_extra' and column_name = 'tiktok_embed_html')),
  ('0019', not exists (select 1 from public.leads where type::text = 'waitlist')),
  ('0020', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'syndication_vehicle_projection' and column_name = 'vehicle_slug')),
  ('0021', not exists (select 1 from public.syndication_dealer where is_default and code <> 'autohauz')),
  ('0022', to_regclass('public.invoice_payments') is not null),
  ('0023', to_regclass('public.blog_article_tags') is not null),
  ('0024', to_regclass('public.email_unsubscribe_tokens') is not null),
  ('20240915', to_regclass('public.pending_admin_roles') is not null),
  ('20260924100000', to_regproc('app_private.forbid_audit_mutation') is not null),
  ('20260924100100', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'invoices' and column_name = 'seller_snapshot')),
  ('20260924100200', to_regproc('public.finish_email_campaign') is not null),
  ('20260924100300', exists (select 1 from pg_constraint where conname = 'vehicles_slug_format'))
) as m(version, present)
order by m.version;
