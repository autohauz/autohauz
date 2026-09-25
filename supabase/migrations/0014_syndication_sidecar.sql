-- ─────────────────────────────────────────────────────────────────────────────
-- 0014  Syndication Sprint 1: dealer, vehicle sidecar, canonical projection
--
-- Adds the syndication data layer WITHOUT touching any existing website table.
-- Per docs/syndication/SYNDICATION-CLAUDE.md Hard Rule 2 and architecture.md §2:
--   • no ALTER on public.vehicles (or any legacy table) — not even a constraint
--   • every canonical field the legacy schema lacks lives in a sidecar
--   • adapters read ONLY the projection view defined at the bottom of this file
--
-- Additive and reversible: this migration creates objects, drops nothing.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Enums (new types; no ALTER TYPE on existing website enums) ───────────────

-- Canonical condition. There is deliberately NO 'new' value: Meta Marketplace
-- supports used and certified-pre-owned only (channels.md §3), and this
-- platform sells used cars exclusively.
create type public.syndication_condition as enum ('used', 'cpo', 'demo');

-- Australian price semantics. Drive-away includes on-road costs; ex-government
-- does not. failure-modes.md F8: this is mandatory and must NEVER be inferred,
-- so the column is nullable with no default and readiness gates block publish
-- until staff set it explicitly.
create type public.syndication_price_type as enum ('drive_away', 'ex_gov');

create type public.au_state as enum ('NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT');

-- ── Dealer ──────────────────────────────────────────────────────────────────
-- This platform is single-company and has no tenancy concept, but
-- architecture.md scopes every syndication table by dealer_id. Carrying a real
-- FK from day one costs one row now and avoids a painful retrofit if AutoHauz
-- becomes the Meta Inventory *Partner* described in channels.md Priority 0 —
-- in which case it syndicates on behalf of multiple rooftops.
create table public.syndication_dealer (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                    -- stable external identifier
  display_name text not null,
  -- IANA zone, never a fixed offset (failure-modes.md F24: AEST/AEDT).
  timezone text not null default 'Australia/Sydney',
  fb_page_id text,                              -- Meta: rooftop's professional page
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Exactly one default dealer; app code resolves it without a hardcoded uuid.
create unique index idx_syndication_dealer_default
  on public.syndication_dealer(is_default) where is_default;

insert into public.syndication_dealer (code, display_name, is_default)
values ('autohauz', 'AutoHauz', true)
on conflict (code) do nothing;

-- ── Vehicle sidecar ─────────────────────────────────────────────────────────
-- Canonical syndication fields absent from public.vehicles. Keyed 1:1 by the
-- legacy vehicle id and LEFT JOINed in the projection, so a vehicle with no
-- sidecar row still projects (with NULLs that the adapters reject on).
--
-- NOTE: vin, registration and rego_expiry already exist on public.vehicles and
-- are NOT duplicated here — the projection reads them from the legacy table.
-- Duplicating them would create two competing sources of truth for the single
-- most important syndication field.
create table public.syndication_vehicle_extra (
  vehicle_id uuid primary key references public.vehicles(id) on delete cascade,
  dealer_id uuid not null references public.syndication_dealer(id),

  -- Identity / compliance
  rego_state public.au_state,
  build_date date,
  compliance_date date,
  -- failure-modes.md F27: written-off vehicle disclosure is an Australian legal
  -- obligation. Where a channel has no disclosure field, publish is blocked
  -- unless the disclosure appears in the description.
  wovr_flag boolean not null default false,

  -- Commercial
  condition public.syndication_condition not null default 'used',
  price_type public.syndication_price_type,     -- intentionally nullable: see F8

  -- Spec detail channels ask for that the legacy schema stores only as free text
  badge text,
  engine_cc integer check (engine_cc is null or engine_cc between 50 and 10000),

  -- Generated copy. Hard Rule 4 / failure-modes.md F5: LLM-written text is a
  -- DRAFT. A NULL description_approved_at blocks publishing generated copy on
  -- every channel — enforced in the adapter, asserted by the projection.
  description_generated text,
  description_approved_at timestamptz,
  description_approved_by uuid references auth.users(id),

  -- failure-modes.md F13: optimistic locking so two staff editing the same
  -- vehicle cannot silently last-write-win.
  version integer not null default 1,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_syn_vehicle_extra_dealer on public.syndication_vehicle_extra(dealer_id);
-- Supports the "needs attention" backfill queues in the admin UI.
create index idx_syn_vehicle_extra_unpriced
  on public.syndication_vehicle_extra(vehicle_id) where price_type is null;

-- Keep updated_at honest and bump the optimistic-lock version on every write.
create or replace function public.touch_syndication_vehicle_extra()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.version := old.version + 1;
  end if;
  return new;
end;
$$;

create trigger trg_touch_syndication_vehicle_extra
before update on public.syndication_vehicle_extra
for each row execute function public.touch_syndication_vehicle_extra();

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Staff-only, both tables. Nothing here is buyer-facing: the sidecar holds VIN
-- adjacent compliance data and internal generated copy.
alter table public.syndication_dealer enable row level security;
alter table public.syndication_vehicle_extra enable row level security;

create policy "syndication_dealer staff read" on public.syndication_dealer
for select using (app_private.is_staff());
create policy "syndication_dealer staff manage" on public.syndication_dealer
for all using (app_private.is_staff()) with check (app_private.is_staff());

create policy "syndication_vehicle_extra staff manage" on public.syndication_vehicle_extra
for all using (app_private.is_staff()) with check (app_private.is_staff());

-- ── Canonical projection (architecture.md §2) ───────────────────────────────
-- The ONLY surface adapters read. The website team can restructure its tables;
-- syndication then breaks at this one seam rather than inside six adapters.
-- It is a plain view (not materialised) so it can never serve stale inventory —
-- a stale feed is how sold vehicles stay advertised (failure-modes.md F3).
--
-- Odometer is ALWAYS integer kilometres here (F7). Adapters convert to miles
-- at their own boundary; nothing upstream of an adapter deals in miles.
create or replace view public.syndication_vehicle_projection as
select
  v.id                                          as vehicle_id,
  coalesce(x.dealer_id, d.id)                   as dealer_id,
  v.location_id,
  v.stock_id                                    as stock_number,

  -- Identity. VIN/rego come from the legacy table (they already exist there).
  nullif(btrim(v.vin), '')                      as vin,
  nullif(btrim(v.registration), '')             as rego,
  x.rego_state,

  mk.name                                       as make,
  md.name                                       as model,
  nullif(btrim(v.variant), '')                  as variant,
  x.badge,
  v.body_type,
  v.year,

  v.mileage_km                                  as odometer_km,
  v.transmission,
  v.fuel_type,
  v.drive_type                                  as drivetrain,
  v.doors,
  v.seats,
  x.engine_cc,
  nullif(btrim(v.engine), '')                   as engine_text,
  nullif(btrim(v.exterior_color), '')           as colour_exterior,
  nullif(btrim(v.interior), '')                 as colour_interior,

  coalesce(x.condition, 'used')                 as condition,
  v.price                                       as price_amount,
  x.price_type,
  'AUD'                                         as currency,

  v.status,
  nullif(btrim(v.description), '')              as description_raw,
  x.description_generated,
  x.description_approved_at,

  x.build_date,
  x.compliance_date,
  coalesce(x.wovr_flag, false)                  as wovr_flag,

  -- Media readiness (failure-modes.md F25): publishing must not push a listing
  -- whose photos are still processing.
  (select count(*) from public.vehicle_images vi where vi.vehicle_id = v.id) as image_count,

  v.updated_at,
  v.sold_at,
  coalesce(x.version, 1)                        as version
from public.vehicles v
join public.makes mk on mk.id = v.make_id
join public.models md on md.id = v.model_id
left join public.syndication_vehicle_extra x on x.vehicle_id = v.id
-- Single-dealer fallback so vehicles without a sidecar row still project.
left join public.syndication_dealer d on d.is_default;

comment on view public.syndication_vehicle_projection is
  'Read-only canonical vehicle shape for syndication adapters (architecture.md §2). '
  'Adapters must not query legacy tables directly. Odometer is always integer km.';

-- ── Projection access control ───────────────────────────────────────────────
-- Anything created in `public` is exposed through PostgREST to the anon and
-- authenticated roles by default, and this view carries the FULL VIN plus
-- internal compliance data. The SRS (§20) keeps full VIN admin-only — public
-- payloads expose at most the masked last-6 — so the view is revoked from every
-- buyer-facing role and granted only to service_role, which is what
-- `createAdminClient()` authenticates as.
--
-- A view is not covered by the RLS policies of its base tables unless it is
-- declared security_invoker, so revoking is the control here, not RLS.
revoke all on public.syndication_vehicle_projection from anon, authenticated;
grant select on public.syndication_vehicle_projection to service_role;
