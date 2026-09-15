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
