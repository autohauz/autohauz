-- Vehicle slug hygiene.
--
-- Root cause: a seeded/hand-entered vehicle has a slug containing a space
-- ("2019-mitsubishi-pajero sport-gls-d006"). The listing and sitemap link to it,
-- the vehicle page 404s, and the sitemap emits an invalid URL. Both application
-- writers (admin form, bulk upload) already slugify; this repairs existing rows,
-- keeps the old address working with a 301, and makes the database reject any
-- future malformed slug.
--
-- Idempotent: rows that already match the format are untouched; redirects use
-- ON CONFLICT DO NOTHING; the constraint is only added once.

do $$
declare
  r record;
  fixed text;
begin
  for r in
    select v.id, v.slug, mk.slug as make_slug, md.slug as model_slug
    from public.vehicles v
    left join public.makes mk on mk.id = v.make_id
    left join public.models md on md.id = v.model_id
    where v.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  loop
    fixed := trim(both '-' from regexp_replace(lower(r.slug), '[^a-z0-9]+', '-', 'g'));
    if fixed = '' then
      fixed := 'vehicle';
    end if;
    -- Keep the unique constraint satisfied if the normalised slug is taken.
    if exists (select 1 from public.vehicles where slug = fixed and id <> r.id) then
      fixed := fixed || '-' || left(replace(r.id::text, '-', ''), 6);
    end if;

    -- The page looks redirects up by the decoded request path.
    if r.make_slug is not null and r.model_slug is not null then
      insert into public.redirects (from_path, to_path, code)
      values (
        '/used-cars/' || r.make_slug || '/' || r.model_slug || '/' || r.slug,
        '/used-cars/' || r.make_slug || '/' || r.model_slug || '/' || fixed,
        301
      )
      on conflict (from_path) do nothing;
    end if;

    update public.vehicles set slug = fixed where id = r.id;
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'vehicles_slug_format' and conrelid = 'public.vehicles'::regclass
  ) then
    alter table public.vehicles
      add constraint vehicles_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
  end if;
end $$;
