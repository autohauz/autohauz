-- ─────────────────────────────────────────────────────────────────────────────
-- 0024  Email marketing module
--
-- Tables:
--   email_contacts          — subscriber/contact database
--   email_segments          — saved segment definitions (JSONB filters)
--   email_templates         — reusable HTML email templates
--   email_campaigns         — campaign records
--   email_campaign_sends    — per-contact send tracking
--   email_events            — delivery events (open/click/bounce/complaint)
--   email_suppressions      — hard bounces + unsubscribes (never send list)
--   email_unsubscribe_tokens — HMAC-signed 1-click unsubscribe tokens
--
-- Security: ALL tables are private. No anon access.
-- Unsubscribe: processed via service-role only (signed token verification in app).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Contacts ─────────────────────────────────────────────────────────────────
create table public.email_contacts (
  id                uuid        primary key default gen_random_uuid(),
  email             text        not null unique,
  first_name        text,
  last_name         text,
  phone             text,
  location          text,
  tags              text[]      not null default '{}',
  source            text,                              -- 'newsletter', 'lead', 'manual', 'import'
  subscription_status text not null default 'subscribed'
    check (subscription_status in ('subscribed', 'unsubscribed', 'bounced', 'complained', 'pending')),
  consent_given     boolean     not null default false,
  consent_at        timestamptz,
  last_sent_at      timestamptz,
  last_opened_at    timestamptz,
  last_clicked_at   timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index idx_email_contacts_status   on public.email_contacts(subscription_status);
create index idx_email_contacts_email    on public.email_contacts(email);
create index idx_email_contacts_source   on public.email_contacts(source);
create index idx_email_contacts_tags     on public.email_contacts using gin(tags);
create index idx_email_contacts_created  on public.email_contacts(created_at desc);

-- ── Segments ─────────────────────────────────────────────────────────────────
create table public.email_segments (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  description text,
  -- Filter definition: { "status": "subscribed", "tags": ["toyota"], "source": "lead" }
  filters     jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Templates ─────────────────────────────────────────────────────────────────
create table public.email_templates (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  subject     text        not null,
  -- Full HTML (table-based, tested across clients). Supports {{first_name}} vars.
  html_body   text        not null,
  text_body   text,
  preview_text text,
  created_by  uuid        references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Campaigns ─────────────────────────────────────────────────────────────────
create table public.email_campaigns (
  id                uuid        primary key default gen_random_uuid(),
  name              text        not null,
  subject           text        not null,
  preview_text      text,
  status            text        not null default 'draft'
    check (status in ('draft', 'scheduled', 'sending', 'sent', 'cancelled', 'failed')),
  template_id       uuid        references public.email_templates(id) on delete set null,
  segment_id        uuid        references public.email_segments(id) on delete set null,
  -- Override HTML (if not using a template or template was customized)
  html_body         text,
  text_body         text,
  -- Scheduling
  scheduled_at      timestamptz,
  sent_at           timestamptz,
  -- Analytics (denormalized counters, updated by webhook/event processor)
  recipients_count  integer     not null default 0,
  sent_count        integer     not null default 0,
  delivered_count   integer     not null default 0,
  opened_count      integer     not null default 0,
  clicked_count     integer     not null default 0,
  bounced_count     integer     not null default 0,
  complained_count  integer     not null default 0,
  unsubscribed_count integer    not null default 0,
  created_by        uuid        references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index idx_email_campaigns_status    on public.email_campaigns(status);
create index idx_email_campaigns_scheduled on public.email_campaigns(scheduled_at)
  where status = 'scheduled';

-- ── Per-contact send records ──────────────────────────────────────────────────
create table public.email_campaign_sends (
  id          uuid        primary key default gen_random_uuid(),
  campaign_id uuid        not null references public.email_campaigns(id) on delete cascade,
  contact_id  uuid        not null references public.email_contacts(id) on delete cascade,
  email       text        not null,                  -- snapshot at send time
  status      text        not null default 'pending'
    check (status in ('pending', 'sent', 'delivered', 'opened', 'clicked',
                      'bounced', 'complained', 'unsubscribed', 'failed')),
  sent_at     timestamptz,
  error       text,
  created_at  timestamptz not null default now(),
  unique (campaign_id, contact_id)
);
create index idx_sends_campaign on public.email_campaign_sends(campaign_id);
create index idx_sends_contact  on public.email_campaign_sends(contact_id);
create index idx_sends_status   on public.email_campaign_sends(status);

-- ── Email events (webhook ingest) ─────────────────────────────────────────────
create table public.email_events (
  id          uuid        primary key default gen_random_uuid(),
  send_id     uuid        references public.email_campaign_sends(id) on delete set null,
  contact_id  uuid        references public.email_contacts(id) on delete set null,
  campaign_id uuid        references public.email_campaigns(id) on delete set null,
  event_type  text        not null
    check (event_type in ('sent','delivered','opened','clicked','bounced',
                          'complained','unsubscribed','failed')),
  metadata    jsonb       not null default '{}'::jsonb,  -- url, user_agent, etc.
  occurred_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
create index idx_email_events_campaign on public.email_events(campaign_id, event_type);
create index idx_email_events_contact  on public.email_events(contact_id, event_type);

-- ── Suppression list ──────────────────────────────────────────────────────────
create table public.email_suppressions (
  id          uuid        primary key default gen_random_uuid(),
  email       text        not null unique,
  reason      text        not null
    check (reason in ('unsubscribed', 'hard_bounce', 'spam_complaint', 'manual')),
  campaign_id uuid        references public.email_campaigns(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index idx_suppressions_email on public.email_suppressions(email);

-- ── Unsubscribe tokens ────────────────────────────────────────────────────────
-- A signed token allows unsubscribe without login. Tokens reference both contact
-- and campaign for precise tracking. Processed via GET /api/unsubscribe?token=...
create table public.email_unsubscribe_tokens (
  id          uuid        primary key default gen_random_uuid(),
  token       text        not null unique,    -- HMAC-SHA256 hex
  contact_id  uuid        not null references public.email_contacts(id) on delete cascade,
  campaign_id uuid        references public.email_campaigns(id) on delete set null,
  used_at     timestamptz,
  expires_at  timestamptz not null default (now() + interval '90 days'),
  created_at  timestamptz not null default now()
);
create index idx_unsub_tokens_token on public.email_unsubscribe_tokens(token);

-- ── RLS — ALL private, no anon access ─────────────────────────────────────────
alter table public.email_contacts           enable row level security;
alter table public.email_segments           enable row level security;
alter table public.email_templates          enable row level security;
alter table public.email_campaigns          enable row level security;
alter table public.email_campaign_sends     enable row level security;
alter table public.email_events             enable row level security;
alter table public.email_suppressions       enable row level security;
alter table public.email_unsubscribe_tokens enable row level security;

-- Contacts: staff read/write only
create policy "email_contacts staff" on public.email_contacts
  for all using (app_private.is_staff()) with check (app_private.is_staff());

-- Segments: staff only
create policy "email_segments staff" on public.email_segments
  for all using (app_private.is_staff()) with check (app_private.is_staff());

-- Templates: staff only
create policy "email_templates staff" on public.email_templates
  for all using (app_private.is_staff()) with check (app_private.is_staff());

-- Campaigns: staff only
create policy "email_campaigns staff" on public.email_campaigns
  for all using (app_private.is_staff()) with check (app_private.is_staff());

-- Sends: staff only
create policy "email_campaign_sends staff" on public.email_campaign_sends
  for all using (app_private.is_staff()) with check (app_private.is_staff());

-- Events: staff only
create policy "email_events staff" on public.email_events
  for all using (app_private.is_staff()) with check (app_private.is_staff());

-- Suppression: staff only
create policy "email_suppressions staff" on public.email_suppressions
  for all using (app_private.is_staff()) with check (app_private.is_staff());

-- Unsubscribe tokens: staff only (service-role bypasses RLS for webhook handler)
create policy "email_unsubscribe_tokens staff" on public.email_unsubscribe_tokens
  for all using (app_private.is_staff()) with check (app_private.is_staff());

-- ── Sync newsletter_subscribers → email_contacts ──────────────────────────────
-- One-time migration of existing newsletter subscribers into the contacts table.
insert into public.email_contacts (email, subscription_status, consent_given, consent_at, source, created_at, updated_at)
select
  lower(n.email),
  case when n.unsubscribed_at is not null then 'unsubscribed' else 'subscribed' end,
  true,
  n.consent_at,
  coalesce(n.source, 'newsletter'),
  n.created_at,
  n.created_at
from public.newsletter_subscribers n
on conflict (email) do nothing;

-- Copy existing unsubscribers into suppression
insert into public.email_suppressions (email, reason, created_at)
select lower(n.email), 'unsubscribed', n.unsubscribed_at
from public.newsletter_subscribers n
where n.unsubscribed_at is not null
on conflict (email) do nothing;
