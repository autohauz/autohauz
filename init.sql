-- 0001_extensions_and_enums.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- 0001  Extensions, private schema, and controlled-vocabulary enums
-- Used-car sales lead-gen platform. Fresh schema (SRS §18).
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists pg_trgm;     -- trigram index for fuzzy title search

-- SECURITY DEFINER authorization helpers live here, out of PostgREST's reach.
create schema if not exists app_private;

-- ── Vehicle attribute vocabularies (SRS §13.1) ──────────────────────────────
create type public.fuel_type as enum (
  'petrol', 'diesel', 'hybrid', 'phev', 'electric', 'lpg'
);
create type public.transmission_type as enum (
  'automatic', 'manual', 'cvt', 'dct'
);
create type public.body_type as enum (
  'sedan', 'hatch', 'suv', 'ute', 'wagon', 'coupe',
  'convertible', 'van', 'people_mover'
);
create type public.drive_type as enum ('fwd', 'rwd', 'awd', 'four_wd');

-- Vehicle lifecycle (SRS §13.2): draft → available → reserved ⇄ available →
-- sold → archived.
create type public.vehicle_status as enum (
  'draft', 'available', 'reserved', 'sold', 'archived'
);

create type public.feature_category as enum (
  'comfort', 'safety', 'technology', 'exterior'
);

-- ── Lead vocabularies (SRS §14, §18) ────────────────────────────────────────
create type public.lead_type as enum (
  'vehicle_enquiry', 'inspection', 'finance', 'trade_in',
  'sell', 'callback', 'general', 'waitlist'
);
create type public.lead_status as enum (
  'new', 'contacted', 'qualified', 'inspection_scheduled',
  'negotiation', 'won', 'lost', 'spam'
);
create type public.lead_loss_reason as enum (
  'price', 'sold_elsewhere', 'finance_declined', 'unresponsive', 'other'
);
create type public.device_type as enum ('mobile', 'desktop', 'tablet', 'unknown');

-- ── Content & staff vocabularies ────────────────────────────────────────────
create type public.testimonial_source as enum ('google', 'facebook', 'direct');
create type public.blog_status as enum ('draft', 'scheduled', 'published');

-- Staff roles (SRS §15.9). Distinct from the retired rental member_role.
create type public.staff_role as enum (
  'owner', 'admin', 'manager', 'sales', 'content'
);


-- 0002_profiles_roles_audit.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- 0002  Staff identity, RBAC helpers, and the append-only activity log
-- Reconciles the SRS `users` table (§18) with Supabase Auth idioms: a
-- profiles row per auth.users, plus an admin_roles row granting staff access.
-- There are NO public/buyer accounts in this product — only staff authenticate.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row here == this profile is a staff member with the given role.
create table public.admin_roles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role public.staff_role not null,
  active boolean not null default true,
  -- MFA is mandatory for owner/admin/manager (SRS §20); optional for sales/content.
  mfa_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Append-only audit trail (SRS §15.9). Written from server code via the
-- service-role client; never mutated or deleted.
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  diff jsonb not null default '{}'::jsonb,
  ip text,
  created_at timestamptz not null default now()
);
create index idx_activity_logs_entity on public.activity_logs(entity_type, entity_id);
create index idx_activity_logs_created on public.activity_logs(created_at desc);

-- ── Authorization helpers ───────────────────────────────────────────────────
-- Any active admin_roles row grants staff access.
create or replace function app_private.is_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.admin_roles
    where user_id = auth.uid() and active = true
  );
$$;

-- Fine-grained gate: does the current user hold one of the given roles?
-- owner/admin are treated as super-users and always pass.
create or replace function app_private.has_staff_role(variadic roles public.staff_role[])
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.admin_roles
    where user_id = auth.uid()
      and active = true
      and (role in ('owner', 'admin') or role = any(roles))
  );
$$;

grant usage on schema app_private to authenticated, service_role;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.admin_roles enable row level security;
alter table public.activity_logs enable row level security;

create policy "profiles readable by self or staff" on public.profiles
for select using (id = auth.uid() or app_private.is_staff());

create policy "profiles updatable by self" on public.profiles
for update using (id = auth.uid()) with check (id = auth.uid());

create policy "admin_roles readable by self or staff" on public.admin_roles
for select using (user_id = auth.uid() or app_private.is_staff());

-- Only owner/admin may grant, revoke, or change staff roles.
create policy "admin_roles managed by owner or admin" on public.admin_roles
for all using (app_private.has_staff_role('owner', 'admin'))
with check (app_private.has_staff_role('owner', 'admin'));

create policy "activity_logs readable by staff" on public.activity_logs
for select using (app_private.is_staff());
-- Writes are service-role only (no anon/authenticated insert policy).


-- 0003_reference_data.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- 0003  Reference data: locations (branches), media, makes/models, features
-- All public-readable, staff-managed. FK targets for vehicles in 0004.
-- ─────────────────────────────────────────────────────────────────────────────

-- Dealership branches. Multiple rows (multi-city per confirmed scope) — each
-- backs a /locations/{city} landing page and NAP block.
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  address text not null,
  city text not null,
  state text not null,
  postcode text,
  phone text,
  whatsapp text,
  lat numeric(9,6),
  lng numeric(9,6),
  hours jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_locations_active on public.locations(is_active) where is_active = true;

-- Uploaded media originals + derived renditions. Not listed directly to the
-- public; consumed via vehicle_images / blog / testimonial joins.
create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  storage_key text not null,
  mime text not null,
  width integer,
  height integer,
  bytes integer,
  renditions jsonb not null default '{}'::jsonb,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.makes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_media_id uuid references public.media_assets(id),
  is_popular boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.models (
  id uuid primary key default gen_random_uuid(),
  make_id uuid not null references public.makes(id) on delete cascade,
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (make_id, slug)
);
create index idx_models_make on public.models(make_id);

create table public.features (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  category public.feature_category not null,
  created_at timestamptz not null default now()
);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.locations enable row level security;
alter table public.media_assets enable row level security;
alter table public.makes enable row level security;
alter table public.models enable row level security;
alter table public.features enable row level security;

create policy "locations public read active" on public.locations
for select using (is_active or app_private.is_staff());
create policy "locations staff manage" on public.locations
for all using (app_private.is_staff()) with check (app_private.is_staff());

-- Media metadata is staff-only; public consumption is through the public
-- storage bucket + resolved URLs, not by listing this table.
create policy "media staff all" on public.media_assets
for all using (app_private.is_staff()) with check (app_private.is_staff());

create policy "makes public read" on public.makes
for select using (true);
create policy "makes staff manage" on public.makes
for all using (app_private.is_staff()) with check (app_private.is_staff());

create policy "models public read" on public.models
for select using (true);
create policy "models staff manage" on public.models
for all using (app_private.is_staff()) with check (app_private.is_staff());

create policy "features public read" on public.features
for select using (true);
create policy "features staff manage" on public.features
for all using (app_private.is_staff()) with check (app_private.is_staff());


-- 0004_vehicles.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- 0004  Vehicles (core inventory) + images, features, price history, stats
-- Full field dictionary per SRS §13.1 / §18.1.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),

  -- Identity
  stock_id text not null unique,                     -- e.g. A1042; shown to buyers
  slug text not null unique,                         -- {year}-{make}-{model}-{variant}-{stock_id}
  make_id uuid not null references public.makes(id),
  model_id uuid not null references public.models(id),
  variant text,
  year integer not null check (year between 1980 and extract(year from now())::int + 1),

  -- Condition / mechanical
  mileage_km integer not null check (mileage_km between 0 and 1000000),
  fuel_type public.fuel_type not null,
  transmission public.transmission_type not null,
  body_type public.body_type not null,
  drive_type public.drive_type,
  engine text,
  power_kw integer check (power_kw is null or power_kw between 1 and 2000),
  seats integer check (seats is null or seats between 1 and 12),
  doors integer check (doors is null or doors between 1 and 6),
  exterior_color text,
  interior text,

  -- Compliance. VIN is sensitive (SRS §20): protected at rest by Supabase disk
  -- encryption, and never included in the public query layer's SELECT list
  -- (public payloads expose at most the masked last-6). Full VIN is admin-only.
  vin text,
  registration text,
  rego_expiry date,

  -- Commercial
  price numeric(10,2) not null check (price > 0),
  previous_price numeric(10,2),
  price_changed_at timestamptz,
  weekly_estimate numeric(10,2),                     -- indicative finance figure

  -- Narrative / trust
  description text,
  safety_rating text,
  warranty_text text,
  roadworthy_included boolean not null default false,
  finance_available boolean not null default true,
  trade_in_welcome boolean not null default true,
  inspection_available boolean not null default true,

  -- Lifecycle / merchandising
  status public.vehicle_status not null default 'draft',
  is_featured boolean not null default false,
  featured_order integer,
  location_id uuid references public.locations(id),
  dealer_notes text,                                 -- internal only, never rendered
  seo_title text,
  seo_description text,
  published_at timestamptz,
  sold_at timestamptz,
  views_count integer not null default 0,

  search_tsv tsvector generated always as (
    to_tsvector('english',
      coalesce(variant, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(exterior_color, '') || ' ' ||
      coalesce(engine, ''))
  ) stored,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes (SRS §18.2)
create index idx_vehicles_status on public.vehicles(status);
create index idx_vehicles_make_model on public.vehicles(make_id, model_id);
create index idx_vehicles_body_type on public.vehicles(body_type);
create index idx_vehicles_price on public.vehicles(price);
create index idx_vehicles_year on public.vehicles(year);
create index idx_vehicles_mileage on public.vehicles(mileage_km);
create index idx_vehicles_published_at on public.vehicles(published_at desc);
create index idx_vehicles_available_price on public.vehicles(price) where status = 'available';
create index idx_vehicles_search_tsv on public.vehicles using gin(search_tsv);
create index idx_vehicles_variant_trgm on public.vehicles using gin(variant gin_trgm_ops);

-- Ordered gallery images (first / is_cover = card image).
create table public.vehicle_images (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  media_id uuid not null references public.media_assets(id),
  sort_order integer not null default 0,
  alt_text text,
  is_cover boolean not null default false,
  created_at timestamptz not null default now(),
  unique (vehicle_id, sort_order)
);
create index idx_vehicle_images_vehicle on public.vehicle_images(vehicle_id);

create table public.vehicle_features (
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  feature_id uuid not null references public.features(id) on delete cascade,
  primary key (vehicle_id, feature_id)
);

-- Immutable price-change log, maintained by trigger below.
create table public.vehicle_price_history (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  old_price numeric(10,2),
  new_price numeric(10,2) not null,
  changed_by uuid references public.profiles(id),
  changed_at timestamptz not null default now()
);
create index idx_price_history_vehicle on public.vehicle_price_history(vehicle_id);

-- Pre-aggregated per-vehicle daily funnel (SRS §18.1) — powers reports without
-- hammering GA.
create table public.vehicle_daily_stats (
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  date date not null,
  views integer not null default 0,
  cta_clicks jsonb not null default '{}'::jsonb,   -- {call: n, whatsapp: n, ...}
  leads integer not null default 0,
  primary key (vehicle_id, date)
);

-- ── Price-change trigger: keep previous_price / price_changed_at accurate and
-- append to vehicle_price_history whenever price changes. ─────────────────────
create or replace function public.handle_vehicle_price_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.price is distinct from old.price then
    new.previous_price := old.price;
    new.price_changed_at := now();
    insert into public.vehicle_price_history (vehicle_id, old_price, new_price, changed_by)
    values (new.id, old.price, new.price, auth.uid());
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_vehicle_price_change
before update on public.vehicles
for each row execute function public.handle_vehicle_price_change();

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.vehicles enable row level security;
alter table public.vehicle_images enable row level security;
alter table public.vehicle_features enable row level security;
alter table public.vehicle_price_history enable row level security;
alter table public.vehicle_daily_stats enable row level security;

-- Public sees anything that has been published and not archived (available,
-- reserved, and recently-sold cars stay briefly listed per SRS §13.2). Draft
-- and archived are staff-only; the 7-day/60-day delisting is enforced in the
-- app/query layer + the redirects table, not RLS.
create policy "vehicles public read published" on public.vehicles
for select using (
  status in ('available', 'reserved', 'sold') or app_private.is_staff()
);
create policy "vehicles staff manage" on public.vehicles
for all using (app_private.is_staff()) with check (app_private.is_staff());

create policy "vehicle_images follow vehicle read" on public.vehicle_images
for select using (
  app_private.is_staff() or exists (
    select 1 from public.vehicles v
    where v.id = vehicle_id and v.status in ('available', 'reserved', 'sold')
  )
);
create policy "vehicle_images staff manage" on public.vehicle_images
for all using (app_private.is_staff()) with check (app_private.is_staff());

create policy "vehicle_features follow vehicle read" on public.vehicle_features
for select using (
  app_private.is_staff() or exists (
    select 1 from public.vehicles v
    where v.id = vehicle_id and v.status in ('available', 'reserved', 'sold')
  )
);
create policy "vehicle_features staff manage" on public.vehicle_features
for all using (app_private.is_staff()) with check (app_private.is_staff());

create policy "price_history staff read" on public.vehicle_price_history
for select using (app_private.is_staff());

create policy "daily_stats staff read" on public.vehicle_daily_stats
for select using (app_private.is_staff());


-- 0005_leads.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- 0005  Leads, the immutable event timeline, and follow-up reminders (SRS §14)
-- Leads are staff-only. Public submissions are inserted server-side via the
-- service-role client AFTER validation + rate-limit + Turnstile (there is no
-- anon/authenticated insert policy — buyers never touch this table directly,
-- and never read it since there are no buyer accounts).
-- ─────────────────────────────────────────────────────────────────────────────

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  type public.lead_type not null,
  status public.lead_status not null default 'new',
  loss_reason public.lead_loss_reason,

  -- Contact
  name text not null,
  phone text not null,                                -- E.164 normalized
  email text,
  message text,

  vehicle_id uuid references public.vehicles(id) on delete set null,
  -- Type-specific fields (inspection slot, finance figures, trade-in car
  -- details, sell-your-car photo ids, waitlist interest, …). Keeps the schema
  -- stable across the 8 lead types (SRS §18.4).
  payload jsonb not null default '{}'::jsonb,

  -- Attribution (SRS §14.1)
  source_url text,
  utm jsonb not null default '{}'::jsonb,
  referrer text,
  device public.device_type,
  ip_hash text,                                       -- salted hash, never raw IP
  consent jsonb not null default '{}'::jsonb,

  -- Pipeline
  assignee_id uuid references public.profiles(id),
  first_contacted_at timestamptz,
  closed_at timestamptz,
  duplicate_of uuid references public.leads(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_leads_status on public.leads(status);
create index idx_leads_type on public.leads(type);
create index idx_leads_created_at on public.leads(created_at desc);
create index idx_leads_phone on public.leads(phone);
create index idx_leads_vehicle on public.leads(vehicle_id);
create index idx_leads_new on public.leads(created_at) where status = 'new';

-- Immutable per-lead timeline (SRS §15.3): created / status_changed / note /
-- reminder_set / assigned / notified / exported.
create table public.lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  event text not null check (event in (
    'created', 'status_changed', 'note', 'reminder_set',
    'assigned', 'notified', 'exported'
  )),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index idx_lead_events_lead on public.lead_events(lead_id, created_at);

create table public.lead_reminders (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  due_at timestamptz not null,
  note text,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_lead_reminders_due on public.lead_reminders(due_at) where done = false;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.leads enable row level security;
alter table public.lead_events enable row level security;
alter table public.lead_reminders enable row level security;

-- Staff-only for select/update/delete. No insert policy for anon/authenticated:
-- all inserts go through the service-role client in the lead API route.
create policy "leads staff read" on public.leads
for select using (app_private.is_staff());
create policy "leads staff update" on public.leads
for update using (app_private.is_staff()) with check (app_private.is_staff());
create policy "leads staff delete" on public.leads
for delete using (app_private.has_staff_role('owner', 'admin', 'manager'));

create policy "lead_events staff read" on public.lead_events
for select using (app_private.is_staff());
create policy "lead_events staff insert" on public.lead_events
for insert with check (app_private.is_staff());

create policy "lead_reminders staff all" on public.lead_reminders
for all using (app_private.is_staff()) with check (app_private.is_staff());


-- 0006_content.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- 0006  Content: testimonials, FAQs, blog, and CMS pages (SRS §9.16–9.19)
-- Testimonials are admin-entered (no customer-submitted reviews in this product).
-- ─────────────────────────────────────────────────────────────────────────────

create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  photo_media_id uuid references public.media_assets(id),
  vehicle_id uuid references public.vehicles(id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  quote text not null,
  source public.testimonial_source not null default 'direct',
  review_date date,
  is_approved boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_testimonials_approved on public.testimonials(is_approved, sort_order);

create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  question text not null,
  answer text not null,
  sort_order integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_faqs_published on public.faqs(is_published, category, sort_order);

create table public.blog_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  category_id uuid references public.blog_categories(id),
  author_id uuid references public.profiles(id),
  cover_media_id uuid references public.media_assets(id),
  excerpt text,
  -- Sanitized HTML string (matches the existing AI blog pipeline, which emits
  -- HTML rather than block JSON — see src/lib/blog/sanitize-html.ts).
  body text not null default '',
  status public.blog_status not null default 'draft',
  published_at timestamptz,
  seo_title text,
  seo_description text,
  reading_minutes integer,
  -- Dedup key for the daily-generation cron (one post per topic).
  topic_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_blog_posts_published on public.blog_posts(status, published_at desc);

-- CMS static pages. Used for legally-editable long-form docs (privacy/terms);
-- other static page layouts are hardcoded React.
create table public.pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  blocks jsonb not null default '[]'::jsonb,
  seo_title text,
  seo_description text,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.testimonials enable row level security;
alter table public.faqs enable row level security;
alter table public.blog_categories enable row level security;
alter table public.blog_posts enable row level security;
alter table public.pages enable row level security;

create policy "testimonials public read approved" on public.testimonials
for select using (is_approved or app_private.is_staff());
create policy "testimonials staff manage" on public.testimonials
for all using (app_private.is_staff()) with check (app_private.is_staff());

create policy "faqs public read published" on public.faqs
for select using (is_published or app_private.is_staff());
create policy "faqs staff manage" on public.faqs
for all using (app_private.is_staff()) with check (app_private.is_staff());

create policy "blog_categories public read" on public.blog_categories
for select using (true);
create policy "blog_categories staff manage" on public.blog_categories
for all using (app_private.is_staff()) with check (app_private.is_staff());

create policy "blog_posts public read published" on public.blog_posts
for select using (status = 'published' or app_private.is_staff());
create policy "blog_posts staff manage" on public.blog_posts
for all using (app_private.is_staff()) with check (app_private.is_staff());

create policy "pages public read published" on public.pages
for select using (is_published or app_private.is_staff());
create policy "pages staff manage" on public.pages
for all using (app_private.is_staff()) with check (app_private.is_staff());


-- 0007_infra_tables.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- 0007  Infra: newsletter, redirects, settings, search-index outbox
-- ─────────────────────────────────────────────────────────────────────────────

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  consent_at timestamptz not null default now(),
  source text,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now()
);

-- 301/302 map: sold/archived VDPs redirect to their model landing page
-- (SRS §13.2, §16.2). Resolved server-side (middleware / route handler).
create table public.redirects (
  id uuid primary key default gen_random_uuid(),
  from_path text not null unique,
  to_path text not null,
  code integer not null default 301 check (code in (301, 302, 307, 308, 410)),
  hits integer not null default 0,
  created_at timestamptz not null default now()
);

-- Key/value config (SRS §15.7): finance params, notification recipients,
-- phone numbers, company profile, legal text, blocked inspection dates.
create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Outbox driving the Typesense sync worker (same pattern as the retired rental
-- schema). A trigger on vehicles enqueues upsert/delete jobs; the
-- search-index-worker edge function drains them.
create table public.search_index_jobs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references public.vehicles(id) on delete cascade,
  operation text not null check (operation in ('upsert', 'delete')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'complete', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index idx_search_jobs_pending on public.search_index_jobs(created_at) where status = 'pending';

create or replace function public.enqueue_search_index_job()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.search_index_jobs (vehicle_id, operation) values (old.id, 'delete');
    return old;
  else
    insert into public.search_index_jobs (vehicle_id, operation) values (new.id, 'upsert');
    return new;
  end if;
end;
$$;

create trigger trg_vehicles_search_index
after insert or update or delete on public.vehicles
for each row execute function public.enqueue_search_index_job();

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.newsletter_subscribers enable row level security;
alter table public.redirects enable row level security;
alter table public.settings enable row level security;
alter table public.search_index_jobs enable row level security;

-- Newsletter subscribe goes through the service-role client in the API route
-- (validated + rate-limited), so no anon insert policy — staff read only.
create policy "newsletter staff read" on public.newsletter_subscribers
for select using (app_private.is_staff());

create policy "redirects staff manage" on public.redirects
for all using (app_private.is_staff()) with check (app_private.is_staff());

create policy "settings staff read" on public.settings
for select using (app_private.is_staff());
create policy "settings staff write" on public.settings
for all using (app_private.has_staff_role('owner', 'admin', 'manager'))
with check (app_private.has_staff_role('owner', 'admin', 'manager'));

create policy "search_jobs staff read" on public.search_index_jobs
for select using (app_private.is_staff());


-- 0008_storage.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- 0008  Storage buckets
--   media            — public read (vehicle photos, blog covers, testimonial
--                      photos, make logos), folder-prefixed; staff write.
--   lead-attachments — private (sell-your-car / trade-in photo uploads);
--                      written via signed URLs, read staff-only.
-- ─────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('media', 'media', true, 10485760,
   array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('lead-attachments', 'lead-attachments', false, 8388608,
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

-- Public bucket: anyone reads; only staff mutate.
create policy "media public read" on storage.objects
for select using (bucket_id = 'media');

create policy "media staff write" on storage.objects
for insert to authenticated
with check (bucket_id = 'media' and app_private.is_staff());

create policy "media staff update" on storage.objects
for update to authenticated
using (bucket_id = 'media' and app_private.is_staff())
with check (bucket_id = 'media' and app_private.is_staff());

create policy "media staff delete" on storage.objects
for delete to authenticated
using (bucket_id = 'media' and app_private.is_staff());

-- Private lead attachments: staff-only read/manage. Buyer uploads use short-lived
-- signed upload URLs minted server-side, so no anon policy is needed here.
create policy "lead attachments staff read" on storage.objects
for select to authenticated
using (bucket_id = 'lead-attachments' and app_private.is_staff());

create policy "lead attachments staff manage" on storage.objects
for all to authenticated
using (bucket_id = 'lead-attachments' and app_private.is_staff())
with check (bucket_id = 'lead-attachments' and app_private.is_staff());


-- 0009_functions.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- 0009  Server-callable functions (RPCs)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Admin dashboard KPIs (SRS §15.1) ────────────────────────────────────────
-- SLA breach = a 'new' lead older than p_sla_minutes (default 15, SRS §2.8).
create or replace function public.get_admin_dashboard_metrics(p_sla_minutes integer default 15)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  result jsonb;
begin
  if not app_private.is_staff() then
    raise exception 'not authorized';
  end if;

  select jsonb_build_object(
    'leads', (
      select jsonb_build_object(
        'total', count(*),
        'new', count(*) filter (where status = 'new'),
        'contacted', count(*) filter (where status = 'contacted'),
        'qualified', count(*) filter (where status = 'qualified'),
        'won', count(*) filter (where status = 'won'),
        'lost', count(*) filter (where status = 'lost'),
        'spam', count(*) filter (where status = 'spam'),
        'awaiting_first_contact', count(*) filter (where status = 'new'),
        'sla_breaches', count(*) filter (
          where status = 'new'
            and created_at < now() - make_interval(mins => p_sla_minutes)
        )
      )
      from public.leads
    ),
    'inventory', (
      select jsonb_build_object(
        'total', count(*),
        'draft', count(*) filter (where status = 'draft'),
        'available', count(*) filter (where status = 'available'),
        'reserved', count(*) filter (where status = 'reserved'),
        'sold', count(*) filter (where status = 'sold'),
        'archived', count(*) filter (where status = 'archived')
      )
      from public.vehicles
    )
  ) into result;

  return result;
end;
$$;

-- ── Atomic lead creation (zero-lead-loss, SRS NFR-4) ─────────────────────────
-- Inserts the lead and its 'created' timeline event in one transaction, so the
-- API route can persist durably before acknowledging. Called with the
-- service-role client after Zod validation + anti-spam checks.
create or replace function public.create_lead_with_event(p_lead jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  insert into public.leads (
    type, status, name, phone, email, message, vehicle_id, payload,
    source_url, utm, referrer, device, ip_hash, consent
  ) values (
    (p_lead->>'type')::public.lead_type,
    coalesce((p_lead->>'status')::public.lead_status, 'new'),
    p_lead->>'name',
    p_lead->>'phone',
    p_lead->>'email',
    p_lead->>'message',
    nullif(p_lead->>'vehicle_id', '')::uuid,
    coalesce(p_lead->'payload', '{}'::jsonb),
    p_lead->>'source_url',
    coalesce(p_lead->'utm', '{}'::jsonb),
    p_lead->>'referrer',
    nullif(p_lead->>'device', '')::public.device_type,
    p_lead->>'ip_hash',
    coalesce(p_lead->'consent', '{}'::jsonb)
  )
  returning id into new_id;

  insert into public.lead_events (lead_id, event, data)
  values (new_id, 'created', jsonb_build_object('type', p_lead->>'type'));

  return new_id;
end;
$$;

-- ── Per-vehicle analytics increments (called via service role) ───────────────
create or replace function public.increment_vehicle_view(p_vehicle_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.vehicles set views_count = views_count + 1 where id = p_vehicle_id;
  insert into public.vehicle_daily_stats (vehicle_id, date, views)
  values (p_vehicle_id, current_date, 1)
  on conflict (vehicle_id, date)
  do update set views = public.vehicle_daily_stats.views + 1;
end;
$$;

create or replace function public.record_cta_click(p_vehicle_id uuid, p_channel text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.vehicle_daily_stats (vehicle_id, date, cta_clicks)
  values (p_vehicle_id, current_date, jsonb_build_object(p_channel, 1))
  on conflict (vehicle_id, date)
  do update set cta_clicks = jsonb_set(
    public.vehicle_daily_stats.cta_clicks,
    array[p_channel],
    to_jsonb(coalesce((public.vehicle_daily_stats.cta_clicks->>p_channel)::int, 0) + 1)
  );
end;
$$;

-- ── Scheduled maintenance jobs (invoked by cron / edge function) ─────────────

-- SRS §13.2: a VDP stays live 60 days after sale, then archives and 301s to its
-- model landing page. Inserts a redirect and flips status to 'archived'.
create or replace function public.expire_stale_vdps()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer := 0;
  rec record;
begin
  for rec in
    select v.id,
           mk.slug as make_slug,
           md.slug as model_slug,
           v.slug  as vehicle_slug
    from public.vehicles v
    join public.makes mk on mk.id = v.make_id
    join public.models md on md.id = v.model_id
    where v.status = 'sold'
      and v.sold_at is not null
      and v.sold_at < now() - interval '60 days'
  loop
    insert into public.redirects (from_path, to_path, code)
    values (
      '/used-cars/' || rec.make_slug || '/' || rec.model_slug || '/' || rec.vehicle_slug,
      '/used-cars/' || rec.make_slug || '/' || rec.model_slug,
      301
    )
    on conflict (from_path) do nothing;

    update public.vehicles set status = 'archived' where id = rec.id;
    affected := affected + 1;
  end loop;
  return affected;
end;
$$;

-- SRS §20: anonymize lead PII after the configured retention window
-- (default 36 months); keep aggregate status data for reporting.
create or replace function public.anonymize_stale_leads(p_months integer default 36)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update public.leads
  set name = 'Anonymized',
      phone = '',
      email = null,
      message = null,
      payload = '{}'::jsonb,
      ip_hash = null,
      referrer = null
  where created_at < now() - make_interval(months => p_months)
    and name <> 'Anonymized';
  get diagnostics affected = row_count;
  return affected;
end;
$$;

grant execute on function public.get_admin_dashboard_metrics(integer) to authenticated;


-- 0010_seed.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- 0010  Seed data (dev/QA baseline; safe to run on a fresh project)
-- Not the full AU catalogue — enough makes/models/features to exercise the UI.
-- Real inventory + full make/model catalogue is a data-entry/import task.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Settings defaults ───────────────────────────────────────────────────────
insert into public.settings (key, value) values
  ('company_profile', jsonb_build_object(
    'legal_name', 'Your Dealership Pty Ltd',
    'trading_name', 'Your Dealership',
    'abn', '',
    'email', 'info@jashire.com.au',
    'google_rating', 4.9,
    'google_review_count', 0
  )),
  ('phone_numbers', jsonb_build_object(
    'primary', '+61492962418',
    'whatsapp', '+61492962418'
  )),
  ('finance_params', jsonb_build_object(
    'annual_rate', 8.99,
    'term_months', 60,
    'deposit_pct', 10,
    'disclaimer', 'Indicative only, not an offer of finance. Weekly repayment estimates assume a fixed rate over the stated term with the stated deposit and exclude fees and charges. Talk to us for a personalised quote.'
  )),
  ('notification_recipients', jsonb_build_object('emails', jsonb_build_array())),
  ('blocked_dates', jsonb_build_object('dates', jsonb_build_array())),
  ('legal_text', jsonb_build_object(
    'contact_consent', 'We only use your details to contact you about this enquiry.'
  ))
on conflict (key) do nothing;

-- ── A starter branch/location ───────────────────────────────────────────────
insert into public.locations (name, slug, address, city, state, postcode, hours, is_active)
values (
  'Main Showroom', 'main-showroom', '14 Harvey Rd', 'Kings Park', 'NSW', '2148',
  jsonb_build_object(
    'mon', '9:00-18:00', 'tue', '9:00-18:00', 'wed', '9:00-18:00',
    'thu', '9:00-18:00', 'fri', '9:00-18:00', 'sat', '9:00-17:00', 'sun', 'closed'
  ),
  true
)
on conflict (slug) do nothing;

-- ── Features (managed vocabulary, grouped by category) ───────────────────────
insert into public.features (name, slug, category) values
  ('Air Conditioning', 'air-conditioning', 'comfort'),
  ('Climate Control', 'climate-control', 'comfort'),
  ('Leather Seats', 'leather-seats', 'comfort'),
  ('Heated Seats', 'heated-seats', 'comfort'),
  ('Keyless Entry', 'keyless-entry', 'comfort'),
  ('Cruise Control', 'cruise-control', 'comfort'),
  ('Reversing Camera', 'reversing-camera', 'safety'),
  ('Blind Spot Monitoring', 'blind-spot-monitoring', 'safety'),
  ('Lane Keep Assist', 'lane-keep-assist', 'safety'),
  ('Autonomous Emergency Braking', 'aeb', 'safety'),
  ('Parking Sensors', 'parking-sensors', 'safety'),
  ('Adaptive Cruise Control', 'adaptive-cruise-control', 'safety'),
  ('Apple CarPlay', 'apple-carplay', 'technology'),
  ('Android Auto', 'android-auto', 'technology'),
  ('Satellite Navigation', 'sat-nav', 'technology'),
  ('Bluetooth', 'bluetooth', 'technology'),
  ('Digital Dashboard', 'digital-dashboard', 'technology'),
  ('Alloy Wheels', 'alloy-wheels', 'exterior'),
  ('Sunroof', 'sunroof', 'exterior'),
  ('Tow Bar', 'tow-bar', 'exterior'),
  ('LED Headlights', 'led-headlights', 'exterior'),
  ('Roof Rails', 'roof-rails', 'exterior')
on conflict (slug) do nothing;

-- ── A handful of popular AU makes + models ──────────────────────────────────
insert into public.makes (name, slug, is_popular) values
  ('Toyota', 'toyota', true),
  ('Mazda', 'mazda', true),
  ('Hyundai', 'hyundai', true),
  ('Ford', 'ford', true),
  ('Kia', 'kia', true),
  ('Mitsubishi', 'mitsubishi', true),
  ('Volkswagen', 'volkswagen', false),
  ('Subaru', 'subaru', false)
on conflict (slug) do nothing;

insert into public.models (make_id, name, slug)
select m.id, x.name, x.slug from public.makes m
join (values
  ('toyota', 'Corolla', 'corolla'),
  ('toyota', 'RAV4', 'rav4'),
  ('toyota', 'HiLux', 'hilux'),
  ('toyota', 'Camry', 'camry'),
  ('mazda', 'CX-5', 'cx-5'),
  ('mazda', 'Mazda3', 'mazda3'),
  ('mazda', 'CX-3', 'cx-3'),
  ('hyundai', 'i30', 'i30'),
  ('hyundai', 'Tucson', 'tucson'),
  ('hyundai', 'Kona', 'kona'),
  ('ford', 'Ranger', 'ranger'),
  ('ford', 'Everest', 'everest'),
  ('kia', 'Sportage', 'sportage'),
  ('kia', 'Cerato', 'cerato'),
  ('mitsubishi', 'Triton', 'triton'),
  ('mitsubishi', 'Outlander', 'outlander'),
  ('volkswagen', 'Golf', 'golf'),
  ('subaru', 'Forester', 'forester')
) as x(make_slug, name, slug) on x.make_slug = m.slug
on conflict (make_id, slug) do nothing;

-- ── Starter FAQs ────────────────────────────────────────────────────────────
insert into public.faqs (category, question, answer, sort_order, is_published) values
  ('Buying', 'Are your cars inspected?', 'Yes — every vehicle passes a multi-point inspection before it is listed, and the condition is documented honestly, including any imperfections.', 1, true),
  ('Buying', 'Can I reserve a car?', 'Contact us and our team will let you know current availability and how to hold a vehicle while you arrange finance or an inspection.', 2, true),
  ('Finance', 'Do you offer finance?', 'We work with finance partners and can help you arrange a car loan. Submit a finance enquiry and a specialist will be in touch.', 1, true),
  ('Finance', 'Can I get finance with no deposit?', 'It depends on your circumstances and the lender. Send us a finance enquiry and we will talk you through the options.', 2, true),
  ('Selling', 'Can I sell you my car?', 'Yes. Use the Sell Your Car form with a few details and photos and we will get back to you with an offer.', 1, true),
  ('Warranty', 'Do the cars come with a warranty?', 'Warranty offerings vary by vehicle and are shown on each listing. Extended warranty options may also be available.', 1, true),
  ('Inspections', 'Can I book a test drive?', 'Absolutely — request an inspection on any vehicle page and we will confirm a time by phone or WhatsApp.', 1, true)
on conflict do nothing;

-- ── Blog categories ─────────────────────────────────────────────────────────
insert into public.blog_categories (name, slug) values
  ('Buying Guides', 'buying-guides'),
  ('Selling Tips', 'selling-tips'),
  ('Finance', 'finance'),
  ('News', 'news')
on conflict (slug) do nothing;


-- 0011_blog_articles.sql
create table public.blog_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  body text not null,
  excerpt text,
  featured_image_url text,
  featured_image_alt text,
  category_id uuid references public.blog_categories(id) on delete set null,
  status text not null default 'draft',
  meta_title text,
  meta_description text,
  reading_time_minutes integer default 0,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  source text not null default 'manual',
  topic_key text unique,
  primary_keyword text,
  tags text[] default array[]::text[]
);

create index idx_blog_articles_published on public.blog_articles(status, published_at desc);

alter table public.blog_articles enable row level security;

create policy "blog_articles public read published" on public.blog_articles
for select using (status = 'published' or app_private.is_staff());

create policy "blog_articles staff manage" on public.blog_articles
for all using (app_private.is_staff()) with check (app_private.is_staff());

-- Drop the old table and its policies
drop policy if exists "blog_posts public read published" on public.blog_posts;
drop policy if exists "blog_posts staff manage" on public.blog_posts;
drop table if exists public.blog_posts;


-- 0012_bidding_and_messaging.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- 0012 Bidding and Messaging
-- Supports buyer-side "Make an Offer" and in-app chat threads.
-- ─────────────────────────────────────────────────────────────────────────────

create type public.bid_status as enum ('pending', 'accepted', 'rejected', 'countered', 'withdrawn');

-- Ensure profiles are automatically created for new users if the trigger is missing
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- It's safe to drop and recreate the trigger
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Bids Table
create table public.bids (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  status public.bid_status not null default 'pending',
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_bids_vehicle on public.bids(vehicle_id);
create index idx_bids_buyer on public.bids(buyer_id);
create index idx_bids_status on public.bids(status);

-- Chat Threads
create table public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references public.vehicles(id) on delete set null,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_chat_threads_vehicle on public.chat_threads(vehicle_id);
create index idx_chat_threads_buyer on public.chat_threads(buyer_id);
create index idx_chat_threads_lead on public.chat_threads(lead_id);

-- Chat Messages
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null, -- Null means system message
  content text not null,
  created_at timestamptz not null default now()
);

create index idx_chat_messages_thread on public.chat_messages(thread_id);
create index idx_chat_messages_created_at on public.chat_messages(created_at);

-- ── RLS Policies ─────────────────────────────────────────────────────────────
alter table public.bids enable row level security;
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;

-- Bids
create policy "bids readable by buyer or staff" on public.bids
for select using (buyer_id = auth.uid() or app_private.is_staff());

create policy "bids insertable by buyer" on public.bids
for insert with check (buyer_id = auth.uid());

create policy "bids updatable by staff or buyer" on public.bids
for update using (buyer_id = auth.uid() or app_private.is_staff());

-- Chat Threads
create policy "chat_threads readable by buyer or staff" on public.chat_threads
for select using (buyer_id = auth.uid() or app_private.is_staff());

create policy "chat_threads insertable by buyer" on public.chat_threads
for insert with check (buyer_id = auth.uid());

-- Chat Messages
create policy "chat_messages readable by thread participants or staff" on public.chat_messages
for select using (
  exists (
    select 1 from public.chat_threads t
    where t.id = thread_id and t.buyer_id = auth.uid()
  ) or app_private.is_staff()
);

create policy "chat_messages insertable by participants or staff" on public.chat_messages
for insert with check (
  (sender_id = auth.uid() and exists (
    select 1 from public.chat_threads t
    where t.id = thread_id and t.buyer_id = auth.uid()
  )) or app_private.is_staff()
);

-- Triggers for updated_at
-- If update_updated_at_column does not exist, we'll create it
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_bids_updated_at
before update on public.bids
for each row execute function public.update_updated_at_column();

create trigger trg_chat_threads_updated_at
before update on public.chat_threads
for each row execute function public.update_updated_at_column();


-- 0013_fix_search_index_fk.sql
-- Remove the restrictive foreign key constraint on the search index outbox.
-- It was causing deletes on `vehicles` to fail because the `search_index_jobs`
-- trigger was trying to insert a reference to a vehicle that was just deleted.

alter table public.search_index_jobs drop constraint if exists search_index_jobs_vehicle_id_fkey;


-- 0014_syndication_sidecar.sql
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
-- FK from day one costs one row now and avoids a painful retrofit if Cars 365
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
values ('cars365', 'Cars 365', true)
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


-- 0015_syndication_channels.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- 0015  Syndication Sprint 2: channel core, enum mapping, sync bookkeeping
--
-- Additive only. Creates no dependency on vehicle data, so it is safe to apply
-- before the VIN backfill completes — none of this publishes anything.
-- Adapters and any outbound push remain unbuilt (see docs/syndication/PLAN.md).
--
-- Still no ALTER on any existing website table (Hard Rule 2).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Enums ───────────────────────────────────────────────────────────────────
create type public.channel_transport_kind as enum ('pull_feed', 'push_api');
create type public.channel_auth_kind as enum ('oauth', 'feed_url', 'none');

create type public.channel_connection_status as enum (
  'not_connected', 'connected', 'action_needed', 'error'
);

-- Publication state machine for one vehicle on one channel.
create type public.channel_listing_state as enum (
  'disabled', 'queued', 'pushed', 'live', 'rejected', 'removing', 'removed'
);

create type public.sync_run_trigger as enum ('scheduled', 'manual', 'sold_fastlane');
create type public.sync_run_status as enum ('running', 'success', 'aborted', 'failed');

-- ── channel ─────────────────────────────────────────────────────────────────
create table public.channel (
  code text primary key,
  display_name text not null,
  market text not null default 'AU',
  transport_kind public.channel_transport_kind not null,
  auth_kind public.channel_auth_kind not null,
  enabled boolean not null default false,
  -- {supports_leads, max_photos, title_max_len, allowed_body_types, ...}
  capabilities jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seeded disabled: a channel must be explicitly turned on after its connection
-- is proven, so applying this migration cannot start publishing anything.
insert into public.channel (code, display_name, transport_kind, auth_kind, enabled, capabilities) values
  ('google_vehicle_ads', 'Google Vehicle Ads', 'pull_feed', 'oauth', false,
   '{"supports_leads": true, "requires_vin": true, "requires_unique_vin": true, "max_photos": 20, "title_max_len": 150}'::jsonb),
  ('meta_marketplace', 'Meta Marketplace Vehicles', 'push_api', 'oauth', false,
   '{"supports_leads": true, "requires_vin": false, "min_odometer_km": 805, "condition_allowlist": ["used", "cpo"], "max_photos": 20}'::jsonb),
  ('whatsapp_catalog', 'WhatsApp Catalogue', 'push_api', 'oauth', false,
   '{"supports_leads": true, "deep_link_to_vdp": true, "max_photos": 10}'::jsonb),
  ('gumtree', 'Gumtree Australia', 'pull_feed', 'feed_url', false,
   '{"supports_leads": true, "requires_vin": false}'::jsonb),
  ('carsales', 'carsales.com.au', 'pull_feed', 'feed_url', false,
   '{"supports_leads": true, "requires_vin": false}'::jsonb),
  ('tiktok_display', 'TikTok (display only)', 'push_api', 'oauth', false,
   '{"supports_leads": false, "read_only": true}'::jsonb)
on conflict (code) do nothing;

-- ── channel_connection ──────────────────────────────────────────────────────
create table public.channel_connection (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references public.syndication_dealer(id) on delete cascade,
  channel_code text not null references public.channel(code) on delete cascade,
  status public.channel_connection_status not null default 'not_connected',

  -- Envelope-encrypted at the application layer with CREDENTIAL_ENCRYPTION_KEY.
  -- NEVER plaintext, never logged, never returned to a client (Hard Rule 5).
  credentials_encrypted bytea,
  external_account_id text,

  -- High-entropy token for pull_feed channels, derived from FEED_SIGNING_SECRET.
  -- `feed_token_previous` supports a 7-day grace window after rotation so a
  -- rotation cannot silently break a channel still polling the old URL (F18).
  feed_token text,
  feed_token_previous text,
  feed_token_rotated_at timestamptz,

  token_expires_at timestamptz,
  last_refreshed_at timestamptz,
  last_error_code text,
  last_error_message text,
  last_error_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dealer_id, channel_code)
);

-- Hourly refresh job finds connections expiring within 24h (F16).
create index idx_channel_connection_expiring
  on public.channel_connection(token_expires_at)
  where token_expires_at is not null;

-- ── channel_listing ─────────────────────────────────────────────────────────
-- The source of truth for publication state: one row per (vehicle, channel).
create table public.channel_listing (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  channel_code text not null references public.channel(code) on delete cascade,
  external_id text,
  state public.channel_listing_state not null default 'disabled',

  -- Stable hash of the rendered payload. Unchanged hash → skip the push, which
  -- prevents rate-limit pressure and account flagging (F15).
  payload_hash text,
  enabled_by_default boolean not null default false,

  last_pushed_at timestamptz,
  last_seen_live_at timestamptz,

  -- Rejections are PERSISTED, never dropped (Hard Rule 7 / F19). The plain
  -- English message and fix hint are what staff read in the vehicle editor.
  rejection_code text,
  rejection_message text,
  rejection_fix_hint text,
  rejection_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vehicle_id, channel_code)
);

create index idx_channel_listing_state on public.channel_listing(channel_code, state);
create index idx_channel_listing_vehicle on public.channel_listing(vehicle_id);
-- Powers the "rejected on any channel" inventory filter.
create index idx_channel_listing_rejected
  on public.channel_listing(channel_code) where state = 'rejected';

-- ── channel_override ────────────────────────────────────────────────────────
-- Channel-specific field values. Architecture invariant: one canonical vehicle
-- shape; per-channel differences live here, never on the vehicle itself.
create table public.channel_override (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  channel_code text not null references public.channel(code) on delete cascade,
  field text not null,
  value text not null,
  created_at timestamptz not null default now(),
  unique (vehicle_id, channel_code, field)
);

-- ── channel_enum_map ────────────────────────────────────────────────────────
-- Every channel has its own closed vocabulary. An unmapped value is a HARD
-- rejection (UNMAPPED_ENUM), never a silent default — defaulting an unknown
-- body type to "Sedan" publishes a factually wrong advertisement (F6).
create table public.channel_enum_map (
  id uuid primary key default gen_random_uuid(),
  channel_code text not null references public.channel(code) on delete cascade,
  canonical_field text not null,
  canonical_value text not null,
  channel_value text not null,
  created_at timestamptz not null default now(),
  unique (channel_code, canonical_field, canonical_value)
);

create index idx_channel_enum_map_lookup
  on public.channel_enum_map(channel_code, canonical_field);

-- Seed the FULL schema enum surface, not merely the values live data happens to
-- contain today. Seeding only observed values means the first electric car or
-- convertible listed fails at publish time with UNMAPPED_ENUM.
insert into public.channel_enum_map (channel_code, canonical_field, canonical_value, channel_value) values
  -- Google Vehicle Ads — body style
  ('google_vehicle_ads', 'body_type', 'sedan',         'Sedan'),
  ('google_vehicle_ads', 'body_type', 'hatch',         'Hatchback'),
  ('google_vehicle_ads', 'body_type', 'suv',           'SUV'),
  ('google_vehicle_ads', 'body_type', 'ute',           'Pickup'),
  ('google_vehicle_ads', 'body_type', 'wagon',         'Wagon'),
  ('google_vehicle_ads', 'body_type', 'coupe',         'Coupe'),
  ('google_vehicle_ads', 'body_type', 'convertible',   'Convertible'),
  ('google_vehicle_ads', 'body_type', 'van',           'Van'),
  ('google_vehicle_ads', 'body_type', 'people_mover',  'Minivan'),
  ('google_vehicle_ads', 'fuel_type', 'petrol',        'Gasoline'),
  ('google_vehicle_ads', 'fuel_type', 'diesel',        'Diesel'),
  ('google_vehicle_ads', 'fuel_type', 'hybrid',        'Hybrid'),
  ('google_vehicle_ads', 'fuel_type', 'phev',          'Plug-in Hybrid'),
  ('google_vehicle_ads', 'fuel_type', 'electric',      'Electric'),
  ('google_vehicle_ads', 'fuel_type', 'lpg',           'LPG'),
  ('google_vehicle_ads', 'transmission', 'automatic',  'Automatic'),
  ('google_vehicle_ads', 'transmission', 'manual',     'Manual'),
  ('google_vehicle_ads', 'transmission', 'cvt',        'Automatic'),
  ('google_vehicle_ads', 'transmission', 'dct',        'Automatic'),
  ('google_vehicle_ads', 'drivetrain', 'fwd',          'FWD'),
  ('google_vehicle_ads', 'drivetrain', 'rwd',          'RWD'),
  ('google_vehicle_ads', 'drivetrain', 'awd',          'AWD'),
  ('google_vehicle_ads', 'drivetrain', 'four_wd',      '4WD'),
  ('google_vehicle_ads', 'condition', 'used',          'Used'),
  ('google_vehicle_ads', 'condition', 'cpo',           'Certified pre-owned'),
  ('google_vehicle_ads', 'condition', 'demo',          'Used'),

  -- Meta Marketplace Vehicles
  ('meta_marketplace', 'body_type', 'sedan',           'SEDAN'),
  ('meta_marketplace', 'body_type', 'hatch',           'HATCHBACK'),
  ('meta_marketplace', 'body_type', 'suv',             'SUV'),
  ('meta_marketplace', 'body_type', 'ute',             'TRUCK'),
  ('meta_marketplace', 'body_type', 'wagon',           'WAGON'),
  ('meta_marketplace', 'body_type', 'coupe',           'COUPE'),
  ('meta_marketplace', 'body_type', 'convertible',     'CONVERTIBLE'),
  ('meta_marketplace', 'body_type', 'van',             'VAN'),
  ('meta_marketplace', 'body_type', 'people_mover',    'MINIVAN'),
  ('meta_marketplace', 'fuel_type', 'petrol',          'GASOLINE'),
  ('meta_marketplace', 'fuel_type', 'diesel',          'DIESEL'),
  ('meta_marketplace', 'fuel_type', 'hybrid',          'HYBRID'),
  ('meta_marketplace', 'fuel_type', 'phev',            'PLUGIN_HYBRID'),
  ('meta_marketplace', 'fuel_type', 'electric',        'ELECTRIC'),
  ('meta_marketplace', 'fuel_type', 'lpg',             'OTHER'),
  ('meta_marketplace', 'transmission', 'automatic',    'AUTOMATIC'),
  ('meta_marketplace', 'transmission', 'manual',       'MANUAL'),
  ('meta_marketplace', 'transmission', 'cvt',          'AUTOMATIC'),
  ('meta_marketplace', 'transmission', 'dct',          'AUTOMATIC'),
  ('meta_marketplace', 'drivetrain', 'fwd',            'FWD'),
  ('meta_marketplace', 'drivetrain', 'rwd',            'RWD'),
  ('meta_marketplace', 'drivetrain', 'awd',            'AWD'),
  ('meta_marketplace', 'drivetrain', 'four_wd',        'FOUR_WHEEL_DRIVE'),
  ('meta_marketplace', 'condition', 'used',            'USED'),
  ('meta_marketplace', 'condition', 'cpo',             'CERTIFIED_PRE_OWNED'),
  ('meta_marketplace', 'condition', 'demo',            'USED')
on conflict (channel_code, canonical_field, canonical_value) do nothing;

-- ── sync_run ────────────────────────────────────────────────────────────────
create table public.sync_run (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references public.syndication_dealer(id) on delete cascade,
  channel_code text not null references public.channel(code) on delete cascade,
  trigger public.sync_run_trigger not null,

  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status public.sync_run_status not null default 'running',

  item_count integer not null default 0,
  ok_count integer not null default 0,
  rejected_count integer not null default 0,
  skipped_count integer not null default 0,

  -- Volume guard bookkeeping. `previous_item_count` is the comparison baseline;
  -- `forced_by` records the human who overrode a tripped guard, because an
  -- override that wipes a dealer's listings must be attributable.
  previous_item_count integer,
  volume_guard_tripped boolean not null default false,
  volume_guard_reason text,
  forced_by uuid references auth.users(id),

  feed_storage_key text,
  -- Truncated before storage; raw responses can contain tokens and PII (F17).
  raw_response_truncated text,
  error_summary text,

  -- True when the run only simulated the push (SYNDICATION_LIVE_PUSH unset or
  -- non-production). Distinguishes "nothing happened" from "nothing was sent".
  dry_run boolean not null default true
);

create index idx_sync_run_recent on public.sync_run(channel_code, started_at desc);
-- The volume guard's baseline lookup: the most recent successful run.
create index idx_sync_run_last_success
  on public.sync_run(dealer_id, channel_code, started_at desc)
  where status = 'success';

-- ── syndication_event (append-only audit log) ───────────────────────────────
create table public.syndication_event (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  -- staff user id, or NULL for 'system'
  actor uuid references auth.users(id),
  vehicle_id uuid references public.vehicles(id) on delete set null,
  channel_code text references public.channel(code) on delete set null,
  event_type text not null,
  detail jsonb not null default '{}'::jsonb
);

create index idx_syndication_event_recent on public.syndication_event(at desc);
create index idx_syndication_event_vehicle on public.syndication_event(vehicle_id, at desc);

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Staff-only across the board. `channel_connection` in particular holds
-- encrypted credentials and feed tokens and must never be readable by a buyer.
alter table public.channel enable row level security;
alter table public.channel_connection enable row level security;
alter table public.channel_listing enable row level security;
alter table public.channel_override enable row level security;
alter table public.channel_enum_map enable row level security;
alter table public.sync_run enable row level security;
alter table public.syndication_event enable row level security;

create policy "channel staff manage" on public.channel
for all using (app_private.is_staff()) with check (app_private.is_staff());

create policy "channel_connection staff manage" on public.channel_connection
for all using (app_private.is_staff()) with check (app_private.is_staff());

create policy "channel_listing staff manage" on public.channel_listing
for all using (app_private.is_staff()) with check (app_private.is_staff());

create policy "channel_override staff manage" on public.channel_override
for all using (app_private.is_staff()) with check (app_private.is_staff());

create policy "channel_enum_map staff manage" on public.channel_enum_map
for all using (app_private.is_staff()) with check (app_private.is_staff());

create policy "sync_run staff read" on public.sync_run
for select using (app_private.is_staff());

-- The audit log is append-only: staff may read and insert, never update or
-- delete. An audit trail a staff member can rewrite is not an audit trail.
create policy "syndication_event staff read" on public.syndication_event
for select using (app_private.is_staff());
create policy "syndication_event staff insert" on public.syndication_event
for insert with check (app_private.is_staff());

-- Credentials are never exposed through PostgREST to buyer-facing roles.
revoke all on public.channel_connection from anon, authenticated;
grant select, insert, update, delete on public.channel_connection to service_role;


-- 0016_media_processing_status.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- 0016  Media processing status
-- Adds processing_status to media_assets to support syndication readiness checks (F25)
-- ─────────────────────────────────────────────────────────────────────────────

create type public.media_processing_status as enum ('processing', 'ready', 'failed');

alter table public.media_assets
add column processing_status public.media_processing_status not null default 'ready';


-- 0017_syndication_meta.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- 0017  Meta Syndication additions (Sprint 5)
-- Adds webhook ingestion queues and lead deduplication properties.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Webhook Ingestion Queue
-- To meet Meta's 5s response requirement (failure-modes.md F21), webhooks are 
-- inserted raw into this table and processed asynchronously.
create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  channel_code text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'complete', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index idx_webhook_events_pending on public.webhook_events(created_at) where status = 'pending';

alter table public.webhook_events enable row level security;
-- Webhooks are written by API endpoints using the service_role key, so no RLS for anon needed.
create policy "webhook_events staff read" on public.webhook_events
for select using (app_private.is_staff());

-- 2. Lead Deduplication
-- Leads need a channel_code and channel_lead_id for deduplication (failure-modes.md F21).
alter table public.leads add column channel_code text;
alter table public.leads add column channel_lead_id text;

-- Add partial unique index to enforce deduplication without constraining direct leads
create unique index idx_leads_channel_dedupe on public.leads(channel_code, channel_lead_id) 
where channel_code is not null and channel_lead_id is not null;


-- 0018_syndication_sprint_6.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- 0018  Syndication Sprint 6: TikTok Integration
--
-- Adds TikTok URL and cached embed HTML to the syndication sidecar, and exposes
-- them via the canonical projection.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.syndication_vehicle_extra add column tiktok_url text;
alter table public.syndication_vehicle_extra add column tiktok_embed_html text;

-- Recreate the projection to expose the new fields
drop view if exists public.syndication_vehicle_projection;

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

  x.tiktok_url,
  x.tiktok_embed_html,

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

revoke all on public.syndication_vehicle_projection from anon, authenticated;
grant select on public.syndication_vehicle_projection to service_role;


-- 0019_newsletter_migrate_waitlist.sql
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


-- 0020_syndication_projection_slugs.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- 0020  Syndication projection: expose URL slugs
--
-- Channel adapters publish a link back to the public vehicle page. The real
-- route is /used-cars/{make_slug}/{model_slug}/{vehicle_slug}, but the
-- projection only carried display names and the stock number, so adapters
-- guessed the path (wrong for multi-word makes such as "Land Rover", and
-- always wrong for the vehicle segment). This appends the three slugs.
--
-- Body is identical to 0018's view (drop + create, comment, revoke, grant)
-- with three columns appended. Application code reads them as optional and
-- falls back to slugified names when absent, so the code can deploy before or
-- after this migration.
--
-- AFTER APPLYING: add `make_slug, model_slug, vehicle_slug` to PROJECTION_SELECT
-- in src/lib/data/syndication.ts so the columns are actually requested.
--
-- Rollback: re-run the view block from 0018_syndication_sprint_6.sql.
-- ─────────────────────────────────────────────────────────────────────────────

drop view if exists public.syndication_vehicle_projection;

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

  x.tiktok_url,
  x.tiktok_embed_html,

  -- Media readiness (failure-modes.md F25): publishing must not push a listing
  -- whose photos are still processing.
  (select count(*) from public.vehicle_images vi where vi.vehicle_id = v.id) as image_count,

  v.updated_at,
  v.sold_at,
  coalesce(x.version, 1)                        as version,

  -- 0020: URL slugs so channel adapters can link to the real vehicle page
  -- (/used-cars/{make_slug}/{model_slug}/{vehicle_slug}). Appended last:
  -- CREATE OR REPLACE VIEW cannot insert columns mid-list.
  mk.slug                                       as make_slug,
  md.slug                                       as model_slug,
  v.slug                                        as vehicle_slug
from public.vehicles v
join public.makes mk on mk.id = v.make_id
join public.models md on md.id = v.model_id
left join public.syndication_vehicle_extra x on x.vehicle_id = v.id
-- Single-dealer fallback so vehicles without a sidecar row still project.
left join public.syndication_dealer d on d.is_default;

comment on view public.syndication_vehicle_projection is
  'Read-only canonical vehicle shape for syndication adapters (architecture.md §2). '
  'Adapters must not query legacy tables directly. Odometer is always integer km.';

revoke all on public.syndication_vehicle_projection from anon, authenticated;
grant select on public.syndication_vehicle_projection to service_role;


-- 0021_rename_default_dealer.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- 0021  Rename the default syndication dealer to AutoHauz
--
-- 0014 seeded the single default dealer as ('cars365', 'Cars 365'). The code
-- is used as an identifier in feed tokens and channel payloads, and the
-- display name appears in channel consoles, so both must reflect the brand.
-- Idempotent; safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

update public.syndication_dealer
set code = 'autohauz',
    display_name = 'AutoHauz'
where is_default = true
  and code = 'cars365';


-- 0022_invoices.sql
-- 0022_invoices.sql
-- Down notes:
-- DROP TABLE invoice_events;
-- DROP TABLE invoice_payments;
-- DROP TABLE invoice_items;
-- DROP TABLE invoices;
-- DROP TABLE invoice_number_sequences;
-- DROP TYPE invoice_status;

BEGIN;

CREATE TYPE invoice_status AS ENUM ('draft', 'issued', 'partially_paid', 'paid', 'void');

-- Number sequence table
CREATE TABLE invoice_number_sequences (
    year int PRIMARY KEY,
    last_value int NOT NULL DEFAULT 0
);

-- Invoices
CREATE TABLE invoices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number text UNIQUE, -- Null for drafts, populated on issue
    status invoice_status NOT NULL DEFAULT 'draft',
    
    lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
    vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
    
    -- Billing party snapshot (frozen on issue)
    billing_name text NOT NULL,
    billing_email text,
    billing_phone text,
    billing_address text,
    billing_abn text,
    
    -- Config snapshot (frozen on issue)
    gst_enabled boolean NOT NULL DEFAULT true,
    gst_rate numeric(5,2) NOT NULL DEFAULT 10.00,
    prices_include_gst boolean NOT NULL DEFAULT true,
    
    -- Amounts (in cents)
    subtotal_cents bigint NOT NULL DEFAULT 0,
    line_discounts_cents bigint NOT NULL DEFAULT 0,
    invoice_discount_cents bigint NOT NULL DEFAULT 0,
    net_ex_gst_cents bigint NOT NULL DEFAULT 0,
    gst_cents bigint NOT NULL DEFAULT 0,
    total_inc_gst_cents bigint NOT NULL DEFAULT 0,
    payments_cents bigint NOT NULL DEFAULT 0,
    
    due_date date,
    issued_at timestamptz,
    paid_at timestamptz,
    voided_at timestamptz,
    
    notes text,
    payment_terms text,
    footer_note text,
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_issued_at ON invoices(issued_at);
CREATE INDEX idx_invoices_lead_id ON invoices(lead_id);
CREATE INDEX idx_invoices_vehicle_id ON invoices(vehicle_id);
CREATE INDEX idx_invoices_invoice_number ON invoices(invoice_number);

-- Invoice items
CREATE TABLE invoice_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    
    description text NOT NULL,
    quantity int NOT NULL DEFAULT 1,
    unit_price_cents bigint NOT NULL DEFAULT 0,
    discount_cents bigint NOT NULL DEFAULT 0,
    
    sort_order int NOT NULL DEFAULT 0,
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);

-- Invoice payments
CREATE TABLE invoice_payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    
    amount_cents bigint NOT NULL,
    payment_date date NOT NULL,
    payment_method text NOT NULL,
    reference_number text,
    notes text,
    
    recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoice_payments_invoice_id ON invoice_payments(invoice_id);

-- Invoice events (audit trail)
CREATE TABLE invoice_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    
    event text NOT NULL, -- e.g., 'created', 'issued', 'payment_recorded', 'voided', 'emailed'
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoice_events_invoice_id ON invoice_events(invoice_id);

-- Triggers for updated_at
CREATE TRIGGER set_updated_at_invoices
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_invoice_items
    BEFORE UPDATE ON invoice_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate next invoice number safely
CREATE OR REPLACE FUNCTION next_invoice_number(p_prefix text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_year int := extract(year from now());
    v_seq int;
BEGIN
    INSERT INTO invoice_number_sequences (year, last_value)
    VALUES (v_year, 1)
    ON CONFLICT (year) DO UPDATE
    SET last_value = invoice_number_sequences.last_value + 1
    RETURNING last_value INTO v_seq;
    
    RETURN p_prefix || '-' || v_year::text || '-' || lpad(v_seq::text, 6, '0');
END;
$$;

-- Trigger to enforce state transitions
CREATE OR REPLACE FUNCTION enforce_invoice_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Allow normal updates if status didn't change
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Enforce valid transitions
    IF OLD.status = 'draft' AND NEW.status NOT IN ('issued', 'void') THEN
        RAISE EXCEPTION 'Invalid transition from draft to %', NEW.status;
    END IF;
    
    IF OLD.status = 'issued' AND NEW.status NOT IN ('partially_paid', 'paid', 'void') THEN
        RAISE EXCEPTION 'Invalid transition from issued to %', NEW.status;
    END IF;
    
    IF OLD.status = 'partially_paid' AND NEW.status NOT IN ('paid', 'void') THEN
        RAISE EXCEPTION 'Invalid transition from partially_paid to %', NEW.status;
    END IF;
    
    IF OLD.status IN ('paid', 'void') THEN
        RAISE EXCEPTION 'Cannot transition from final state %', OLD.status;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER check_invoice_status_transition
    BEFORE UPDATE OF status ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION enforce_invoice_status_transition();

-- Trigger to auto-update invoice status on payment insert
CREATE OR REPLACE FUNCTION update_invoice_payment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_paid bigint;
    v_total_inc_gst bigint;
BEGIN
    -- Calculate total payments
    SELECT COALESCE(SUM(amount_cents), 0) INTO v_total_paid
    FROM invoice_payments
    WHERE invoice_id = NEW.invoice_id;
    
    -- Get total amount
    SELECT total_inc_gst_cents INTO v_total_inc_gst
    FROM invoices
    WHERE id = NEW.invoice_id;
    
    -- Update invoice
    UPDATE invoices
    SET payments_cents = v_total_paid,
        status = CASE 
            WHEN v_total_paid >= v_total_inc_gst THEN 'paid'::invoice_status
            ELSE 'partially_paid'::invoice_status
        END,
        paid_at = CASE 
            WHEN v_total_paid >= v_total_inc_gst THEN now()
            ELSE paid_at
        END
    WHERE id = NEW.invoice_id;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER after_payment_insert
    AFTER INSERT OR UPDATE OR DELETE ON invoice_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_invoice_payment_status();

-- Row Level Security (RLS)
ALTER TABLE invoice_number_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_events ENABLE ROW LEVEL SECURITY;

-- Staff can do everything to invoices
CREATE POLICY "Staff can select all invoices" ON invoices FOR SELECT TO authenticated USING (app_private.is_staff());
CREATE POLICY "Staff can insert invoices" ON invoices FOR INSERT TO authenticated WITH CHECK (app_private.is_staff());
CREATE POLICY "Staff can update invoices" ON invoices FOR UPDATE TO authenticated USING (app_private.is_staff());

CREATE POLICY "Staff can select invoice items" ON invoice_items FOR SELECT TO authenticated USING (app_private.is_staff());
CREATE POLICY "Staff can insert invoice items" ON invoice_items FOR INSERT TO authenticated WITH CHECK (app_private.is_staff());
CREATE POLICY "Staff can update invoice items" ON invoice_items FOR UPDATE TO authenticated USING (app_private.is_staff());
CREATE POLICY "Staff can delete invoice items" ON invoice_items FOR DELETE TO authenticated USING (app_private.is_staff());

CREATE POLICY "Staff can select invoice payments" ON invoice_payments FOR SELECT TO authenticated USING (app_private.is_staff());
CREATE POLICY "Staff can insert invoice payments" ON invoice_payments FOR INSERT TO authenticated WITH CHECK (app_private.is_staff());

CREATE POLICY "Staff can select invoice events" ON invoice_events FOR SELECT TO authenticated USING (app_private.is_staff());
CREATE POLICY "Staff can insert invoice events" ON invoice_events FOR INSERT TO authenticated WITH CHECK (app_private.is_staff());

COMMIT;


-- 20240915_pending_admin_roles.sql
-- pending_admin_roles
-- Stores admin role assignments for emails that don't yet have a Supabase
-- account. The row is consumed (deleted) automatically in the auth callback
-- the first time the person signs in with Google.

create table if not exists public.pending_admin_roles (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  role        text not null,
  mfa_required boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Only the service-role key (used by admin clients) should access this table.
alter table public.pending_admin_roles enable row level security;

-- No anon/authenticated policy — admin SDK bypasses RLS anyway.


