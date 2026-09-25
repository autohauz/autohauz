-- ─────────────────────────────────────────────────────────────────────────────
-- Email marketing delivery (audit 2026-09-24: DB-05, DB-07, DB-18, SEC-08,
-- SEC-15). Depends on 0024. Additive; no data dropped.
--
--  1. Consent record columns; suppression is enforced by a trigger (nobody on
--     the suppression list can be "subscribed" by any path).
--  2. Double opt-in: subscribe_request() never subscribes directly — it
--     returns 'confirm' and the app emails a signed link; confirm_subscription()
--     completes it. Hard bounces / complaints are never re-subscribed.
--  3. unsubscribe_email_contact(): idempotent, writes the suppression list.
--  4. Campaign sending as a queue: start_email_campaign() atomically moves a
--     draft/scheduled campaign to 'sending' and materialises one
--     email_campaign_sends row per eligible recipient (UNIQUE(campaign,
--     contact) makes a double start harmless); claim_email_sends() hands out
--     batches with FOR UPDATE SKIP LOCKED; finish_email_campaign() closes it.
--  5. Block-based templates (blocks jsonb).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Columns ──────────────────────────────────────────────────────────────
alter table public.email_contacts add column if not exists consent_source text;
alter table public.email_contacts add column if not exists consent_ip_hash text;
alter table public.email_contacts add column if not exists unsubscribed_at timestamptz;
alter table public.email_contacts add column if not exists confirmation_sent_at timestamptz;

alter table public.email_templates add column if not exists blocks jsonb;

alter table public.email_campaign_sends add column if not exists attempts integer not null default 0;
alter table public.email_campaign_sends add column if not exists claimed_at timestamptz;

do $$
declare
  c text;
begin
  -- Allow the in-flight 'processing' state in the send queue.
  select conname into c from pg_constraint
  where conrelid = 'public.email_campaign_sends'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%pending%';
  if c is not null then
    execute format('alter table public.email_campaign_sends drop constraint %I', c);
  end if;
  alter table public.email_campaign_sends add constraint email_campaign_sends_status_check
    check (status in ('pending', 'processing', 'sent', 'delivered', 'opened', 'clicked',
                      'bounced', 'complained', 'unsubscribed', 'failed', 'skipped'));
end $$;

create index if not exists idx_sends_queue on public.email_campaign_sends(campaign_id, status, created_at);

-- Suppressed addresses can never be marked subscribed, whatever the path.
create or replace function app_private.enforce_email_suppression()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.email := lower(trim(new.email));
  if new.subscription_status = 'subscribed'
     and exists (select 1 from public.email_suppressions s where s.email = new.email) then
    raise exception 'Address is on the suppression list' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_email_contacts_suppression on public.email_contacts;
create trigger trg_email_contacts_suppression
  before insert or update on public.email_contacts
  for each row execute function app_private.enforce_email_suppression();

-- ── 2. Double opt-in ────────────────────────────────────────────────────────
create or replace function public.subscribe_request(p_email text, p_source text, p_ip_hash text)
returns table (contact_id uuid, outcome text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(trim(p_email));
  v_contact public.email_contacts%rowtype;
  v_reason text;
begin
  select reason into v_reason from public.email_suppressions where email = v_email;
  -- Hard bounces and complaints are permanent; never mail them again.
  if v_reason in ('hard_bounce', 'spam_complaint') then
    return query select null::uuid, 'blocked'::text;
    return;
  end if;

  select * into v_contact from public.email_contacts where email = v_email for update;

  if found and v_contact.subscription_status = 'subscribed' then
    return query select v_contact.id, 'already_subscribed'::text;
    return;
  end if;
  if found and v_contact.subscription_status in ('bounced', 'complained') then
    return query select v_contact.id, 'blocked'::text;
    return;
  end if;

  if not found then
    insert into public.email_contacts (email, source, subscription_status, consent_given, consent_source, consent_ip_hash)
    values (v_email, left(coalesce(p_source, 'website'), 80), 'pending', false, left(p_source, 80), p_ip_hash)
    returning * into v_contact;
  else
    -- pending or unsubscribed: stays as it is until the link is confirmed.
    update public.email_contacts
       set consent_source = left(coalesce(p_source, consent_source), 80),
           consent_ip_hash = p_ip_hash,
           updated_at = now()
     where id = v_contact.id;
  end if;

  return query select v_contact.id, 'confirm'::text;
end;
$$;

create or replace function public.confirm_subscription(p_contact_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_contact public.email_contacts%rowtype;
begin
  select * into v_contact from public.email_contacts where id = p_contact_id for update;
  if not found then
    return null;
  end if;
  if v_contact.subscription_status in ('bounced', 'complained') then
    return null;
  end if;
  if v_contact.subscription_status = 'subscribed' then
    return v_contact.email;
  end if;

  -- Explicit, confirmed re-opt-in lifts a previous voluntary unsubscribe only.
  delete from public.email_suppressions where email = v_contact.email and reason = 'unsubscribed';

  update public.email_contacts
     set subscription_status = 'subscribed',
         consent_given = true,
         consent_at = now(),
         unsubscribed_at = null,
         updated_at = now()
   where id = p_contact_id;

  return v_contact.email;
end;
$$;

-- ── 3. Unsubscribe ──────────────────────────────────────────────────────────
create or replace function public.unsubscribe_email_contact(p_contact_id uuid, p_campaign_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_contact public.email_contacts%rowtype;
  v_campaign uuid := p_campaign_id;
  v_changed boolean;
begin
  select * into v_contact from public.email_contacts where id = p_contact_id for update;
  if not found then
    return null;
  end if;
  if v_campaign is not null and not exists (select 1 from public.email_campaigns where id = v_campaign) then
    v_campaign := null;
  end if;

  v_changed := v_contact.subscription_status <> 'unsubscribed';

  update public.email_contacts
     set subscription_status = case when subscription_status in ('bounced', 'complained') then subscription_status else 'unsubscribed' end,
         unsubscribed_at = coalesce(unsubscribed_at, now()),
         updated_at = now()
   where id = p_contact_id;

  insert into public.email_suppressions (email, reason, campaign_id)
  values (v_contact.email, 'unsubscribed', v_campaign)
  on conflict (email) do nothing;

  if v_changed then
    insert into public.email_events (contact_id, campaign_id, event_type)
    values (p_contact_id, v_campaign, 'unsubscribed');
    if v_campaign is not null then
      update public.email_campaigns set unsubscribed_count = unsubscribed_count + 1 where id = v_campaign;
      update public.email_campaign_sends set status = 'unsubscribed'
       where campaign_id = v_campaign and contact_id = p_contact_id;
    end if;
  end if;

  return v_contact.email;
end;
$$;

-- ── 4. Sending queue ────────────────────────────────────────────────────────
-- Segment filters (email_segments.filters): {"tags": [...] (any), "source": "...", "location": "..."}.
create or replace function public.start_email_campaign(p_campaign_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_campaign public.email_campaigns%rowtype;
  v_filters jsonb := '{}'::jsonb;
  v_tags text[];
  v_count integer;
begin
  select * into v_campaign from public.email_campaigns where id = p_campaign_id for update;
  if not found then
    raise exception 'Campaign not found' using errcode = 'P0002';
  end if;
  if v_campaign.status not in ('draft', 'scheduled') then
    raise exception 'Only draft or scheduled campaigns can be sent (status: %)', v_campaign.status using errcode = '55000';
  end if;
  if v_campaign.template_id is null and v_campaign.html_body is null then
    raise exception 'Choose a template before sending' using errcode = '55000';
  end if;

  if v_campaign.segment_id is not null then
    select filters into v_filters from public.email_segments where id = v_campaign.segment_id;
    v_filters := coalesce(v_filters, '{}'::jsonb);
  end if;
  if jsonb_typeof(v_filters->'tags') = 'array' then
    select array_agg(value) into v_tags from jsonb_array_elements_text(v_filters->'tags');
  end if;

  insert into public.email_campaign_sends (campaign_id, contact_id, email, status)
  select p_campaign_id, c.id, c.email, 'pending'
  from public.email_contacts c
  where c.subscription_status = 'subscribed'
    and c.consent_given
    and not exists (select 1 from public.email_suppressions s where s.email = c.email)
    and (v_tags is null or c.tags && v_tags)
    and (v_filters->>'source' is null or c.source = v_filters->>'source')
    and (v_filters->>'location' is null or c.location ilike v_filters->>'location')
  on conflict (campaign_id, contact_id) do nothing;

  get diagnostics v_count = row_count;

  update public.email_campaigns
     set status = 'sending', recipients_count = v_count, updated_at = now()
   where id = p_campaign_id;

  return v_count;
end;
$$;

create or replace function public.claim_email_sends(p_campaign_id uuid, p_limit integer)
returns table (send_id uuid, contact_id uuid, email text, first_name text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with next_batch as (
    select s.id
    from public.email_campaign_sends s
    where s.campaign_id = p_campaign_id
      and (s.status = 'pending'
           -- a worker that died mid-batch: retry after 10 minutes, max 3 tries
           or (s.status = 'processing' and s.claimed_at < now() - interval '10 minutes' and s.attempts < 3))
    order by s.created_at
    limit greatest(1, least(p_limit, 200))
    for update skip locked
  )
  update public.email_campaign_sends s
     set status = 'processing', claimed_at = now(), attempts = s.attempts + 1
    from next_batch
   where s.id = next_batch.id
  returning s.id, s.contact_id, s.email,
            (select c.first_name from public.email_contacts c where c.id = s.contact_id);
end;
$$;

-- Marks the campaign 'sent' once nothing is left to send; returns true if done.
create or replace function public.finish_email_campaign(p_campaign_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1 from public.email_campaign_sends
    where campaign_id = p_campaign_id
      and (status = 'pending' or (status = 'processing' and attempts < 3))
  ) then
    return false;
  end if;

  update public.email_campaigns c set
    status = 'sent',
    sent_at = coalesce(c.sent_at, now()),
    sent_count = (select count(*) from public.email_campaign_sends s
                  where s.campaign_id = c.id and s.status in ('sent', 'delivered', 'opened', 'clicked', 'unsubscribed')),
    bounced_count = (select count(*) from public.email_campaign_sends s
                     where s.campaign_id = c.id and s.status = 'bounced'),
    updated_at = now()
  where c.id = p_campaign_id and c.status = 'sending';
  return true;
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.subscribe_request(text, text, text)',
    'public.confirm_subscription(uuid)',
    'public.unsubscribe_email_contact(uuid, uuid)',
    'public.start_email_campaign(uuid)',
    'public.claim_email_sends(uuid, integer)',
    'public.finish_email_campaign(uuid)'
  ]
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end $$;
