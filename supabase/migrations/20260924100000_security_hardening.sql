-- ─────────────────────────────────────────────────────────────────────────────
-- Security hardening (audit 2026-09-24: SEC-01, SEC-07, SEC-09, SEC-16,
-- SEC-17, DB-01, DB-17, DB-19). Additive and idempotent: no data is dropped
-- or rewritten, and every statement can be re-run safely.
--
-- NOTE ON NAMING: the Supabase CLI orders migrations by their numeric prefix.
-- `20240915_pending_admin_roles.sql` already sorts after `0024_…`, so a new
-- `0025_…` file would sort *before* it and `db push` would refuse it. New
-- migrations therefore use the YYYYMMDDHHMMSS form.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. RPC surface: no public EXECUTE on privileged functions (SEC-01) ──────
-- Postgres grants EXECUTE to PUBLIC on every new function, and Supabase's
-- default privileges also grant it to anon/authenticated, so each SECURITY
-- DEFINER function below was callable by anyone holding the browser's
-- publishable key via POST /rest/v1/rpc/<name> — including
-- anonymize_stale_leads(0), which irreversibly wipes every lead's PII.
-- The application calls all of them with the service-role client only.

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.create_lead_with_event(jsonb)',
    'public.increment_vehicle_view(uuid)',
    'public.record_cta_click(uuid, text)',
    'public.expire_stale_vdps()',
    'public.anonymize_stale_leads(integer)',
    'public.next_invoice_number(text)',
    'public.publish_scheduled_articles()',
    'public.handle_new_user()',
    'public.handle_vehicle_price_change()',
    'public.enqueue_search_index_job()',
    'public.touch_syndication_vehicle_extra()',
    'public.update_invoice_payment_status()',
    'public.enforce_invoice_status_transition()'
  ]
  loop
    if to_regprocedure(fn) is not null then
      execute format('revoke execute on function %s from public, anon, authenticated', fn);
      execute format('grant execute on function %s to service_role', fn);
    end if;
  end loop;
end $$;

-- get_admin_dashboard_metrics guards itself with is_staff(); it stays callable
-- by signed-in users (0009) but never by anon.
do $$
begin
  if to_regprocedure('public.get_admin_dashboard_metrics(integer)') is not null then
    revoke execute on function public.get_admin_dashboard_metrics(integer) from public, anon;
    grant execute on function public.get_admin_dashboard_metrics(integer) to authenticated, service_role;
  end if;
end $$;

-- Future functions created by the migration role start private; each one that
-- must be public gets an explicit GRANT in its own migration.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ── 2. search_path on SECURITY DEFINER functions (SEC-16) ───────────────────
-- Without a fixed search_path a definer function resolves unqualified names
-- through the caller's path, which is a privilege-escalation vector.
do $$
begin
  if to_regprocedure('public.next_invoice_number(text)') is not null then
    alter function public.next_invoice_number(text) set search_path = public, pg_temp;
  end if;
  if to_regprocedure('public.update_invoice_payment_status()') is not null then
    alter function public.update_invoice_payment_status() set search_path = public, pg_temp;
  end if;
  if to_regprocedure('public.handle_new_user()') is not null then
    alter function public.handle_new_user() set search_path = public, pg_temp;
  end if;
end $$;

-- ── 3. Profiles: users may not rewrite their own identity (SEC-07) ──────────
-- 0002 lets a user update their whole profile row. Role assignment used to
-- match on profiles.email, so a self-service email change could capture a
-- role meant for someone else. The app now resolves accounts through
-- auth.users; this trigger also pins id/email for user-session updates.
create or replace function app_private.protect_profile_identity()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- Service-role / SQL-editor writes (no end-user JWT) are trusted.
  if auth.uid() is null then
    return new;
  end if;
  new.id := old.id;
  new.email := old.email;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists trg_protect_profile_identity on public.profiles;
create trigger trg_protect_profile_identity
  before update on public.profiles
  for each row execute function app_private.protect_profile_identity();

-- ── 4. Staff roles: only an owner can create, change or remove owners ───────
-- The RLS policy lets owner *or* admin manage admin_roles, which let an admin
-- promote themselves to owner straight through PostgREST. The app enforces
-- the same rule (lib/security/permissions.ts canManageRole).
create or replace function app_private.guard_admin_roles()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  touches_owner boolean;
begin
  if auth.uid() is null then
    return coalesce(new, old); -- service role: the application enforces policy
  end if;

  touches_owner := (tg_op <> 'INSERT' and old.role = 'owner')
                or (tg_op <> 'DELETE' and new.role = 'owner');

  if touches_owner and not exists (
    select 1 from public.admin_roles
    where user_id = auth.uid() and active and role = 'owner'
  ) then
    raise exception 'Only an owner can grant, change or revoke the owner role'
      using errcode = '42501';
  end if;

  if coalesce(new.user_id, old.user_id) = auth.uid() then
    raise exception 'Staff cannot change their own role' using errcode = '42501';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_guard_admin_roles on public.admin_roles;
create trigger trg_guard_admin_roles
  before insert or update or delete on public.admin_roles
  for each row execute function app_private.guard_admin_roles();

-- Pending grants: constrain the role text and store emails lower-cased so the
-- callback can match exactly (it used ILIKE, where `_`/`%` are wildcards).
update public.pending_admin_roles set email = lower(email) where email <> lower(email);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pending_admin_roles_role_check') then
    alter table public.pending_admin_roles
      add constraint pending_admin_roles_role_check
      check (role in ('owner', 'admin', 'manager', 'sales', 'content')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pending_admin_roles_email_lower') then
    alter table public.pending_admin_roles
      add constraint pending_admin_roles_email_lower check (email = lower(email)) not valid;
  end if;
end $$;

-- ── 5. Leftover buyer tables: read-only for end users (SEC-17 / DB-27) ──────
-- bids / chat_* belong to the retired marketplace model and have no UI, but
-- their policies still let any signed-up user insert rows and even mark their
-- own bid "accepted". Writes are revoked rather than the tables dropped, so
-- no data is destroyed; drop them in a later cleanup once confirmed unused.
do $$
declare
  t text;
begin
  foreach t in array array['bids', 'chat_threads', 'chat_messages'] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke insert, update, delete on public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- ── 6. Audit log is append-only (DB-19 / SEC-20) ────────────────────────────
-- No policy allows UPDATE/DELETE, but the service role bypasses RLS. This
-- trigger makes history immutable for every role; a genuine retention purge
-- must disable it explicitly in a reviewed migration.
create or replace function app_private.forbid_audit_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'activity_logs is append-only' using errcode = '42501';
end;
$$;

drop trigger if exists trg_activity_logs_append_only on public.activity_logs;
create trigger trg_activity_logs_append_only
  before update or delete on public.activity_logs
  for each row execute function app_private.forbid_audit_mutation();

-- Staff user deletion used to fail on this FK (DB-20); history survives with a
-- null actor instead.
do $$
declare
  fk text;
begin
  select conname into fk from pg_constraint
  where conrelid = 'public.activity_logs'::regclass and contype = 'f'
    and conkey = array[(select attnum from pg_attribute
                        where attrelid = 'public.activity_logs'::regclass and attname = 'user_id')];
  if fk is not null then
    execute format('alter table public.activity_logs drop constraint %I', fk);
  end if;
  alter table public.activity_logs
    add constraint activity_logs_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete set null;
end $$;

-- ── 7. Marketing consent: nobody is "subscribed" without consent (DB-17) ────
do $$
begin
  if to_regclass('public.email_contacts') is not null then
    alter table public.email_contacts alter column subscription_status set default 'pending';
    -- Existing rows came from the newsletter backfill (consent_given = true).
    if not exists (select 1 from pg_constraint where conname = 'email_contacts_subscribed_requires_consent') then
      alter table public.email_contacts
        add constraint email_contacts_subscribed_requires_consent
        check (subscription_status <> 'subscribed' or consent_given) not valid;
    end if;
    if not exists (select 1 from pg_constraint where conname = 'email_contacts_email_lower') then
      alter table public.email_contacts
        add constraint email_contacts_email_lower check (email = lower(email)) not valid;
    end if;
  end if;
end $$;
