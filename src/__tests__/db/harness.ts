import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

/**
 * In-process Postgres (PGlite) with the pieces of the Supabase platform the
 * migrations depend on, so migrations, triggers, grants and RLS can be tested
 * without Docker or a hosted project.
 *
 * Fidelity notes — what this does and does NOT model:
 *  - roles anon / authenticated / service_role, Supabase's default privileges
 *    (which is what made SECURITY DEFINER RPCs public in the first place);
 *  - auth.uid() from `request.jwt.claim.sub`, like PostgREST sets it;
 *  - auth.users, storage.buckets/objects (enough for the storage policies);
 *  - NOT PostgREST itself, GoTrue, or storage-api behaviour.
 */
const PLATFORM_SHIM = `
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  phone text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  raw_app_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create function auth.role() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claim.role', true), '')
$$;
grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;

create schema storage;
grant usage on schema storage to anon, authenticated, service_role;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz default now()
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  metadata jsonb,
  created_at timestamptz default now()
);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
grant all on storage.objects, storage.buckets to anon, authenticated, service_role;
`;

export const MIGRATIONS_DIR = join(__dirname, "..", "..", "..", "supabase", "migrations");

/** Migration files in the order the Supabase CLI applies them (numeric version prefix). */
export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort((a, b) => {
      const va = BigInt(a.split("_", 1)[0]);
      const vb = BigInt(b.split("_", 1)[0]);
      return va < vb ? -1 : va > vb ? 1 : 0;
    });
}

export async function createDatabase(): Promise<PGlite> {
  const db = new PGlite({ extensions: { pg_trgm, pgcrypto } });
  await db.exec(PLATFORM_SHIM);
  for (const file of migrationFiles()) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    try {
      await db.exec(sql);
    } catch (err) {
      throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
    }
  }
  return db;
}

/**
 * Runs `fn` as a PostgREST-style request: `SET ROLE` to the database role and
 * the JWT subject exposed through auth.uid(). Always restored afterwards.
 */
export async function asRole<T>(
  db: PGlite,
  role: "anon" | "authenticated" | "service_role",
  userId: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  await db.exec(`select set_config('request.jwt.claim.sub', '${userId ?? ""}', false)`);
  await db.exec(`set role ${role}`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.exec(`select set_config('request.jwt.claim.sub', '', false)`);
  }
}

/** Creates an auth user + profile (via the handle_new_user trigger) and returns its id. */
export async function createUser(db: PGlite, email: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    "insert into auth.users (email) values ($1) returning id",
    [email],
  );
  return rows[0].id;
}

export async function grantStaffRole(db: PGlite, userId: string, role: string) {
  await db.query(
    "insert into public.admin_roles (user_id, role, active, mfa_required) values ($1, $2, true, false)",
    [userId, role],
  );
}
