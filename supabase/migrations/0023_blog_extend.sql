-- ─────────────────────────────────────────────────────────────────────────────
-- 0023  Blog CMS extensions
--
-- Extends blog_articles with the fields required for a full editorial CMS:
--   • author_id / author_name  — who wrote it
--   • scheduled_at             — when a SCHEDULED post goes live
--   • social_image_url         — OG/Twitter image override
--   • canonical_url            — optional canonical override
-- Also adds 'archived' to the blog_status enum and creates a proper
-- blog_tags join pattern.
-- ─────────────────────────────────────────────────────────────────────────────

-- Add 'archived' to the existing blog_status enum
alter type public.blog_status add value if not exists 'archived';

-- Extend blog_articles
alter table public.blog_articles
  add column if not exists author_id    uuid references public.profiles(id) on delete set null,
  add column if not exists author_name  text,
  add column if not exists scheduled_at timestamptz,
  add column if not exists social_image_url text,
  add column if not exists canonical_url text;

-- Blog tags (managed vocabulary)
create table if not exists public.blog_tags (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  created_at timestamptz not null default now()
);

-- Article ↔ tag junction
create table if not exists public.blog_article_tags (
  article_id uuid not null references public.blog_articles(id) on delete cascade,
  tag_id     uuid not null references public.blog_tags(id) on delete cascade,
  primary key (article_id, tag_id)
);

-- Useful indexes
create index if not exists idx_blog_articles_scheduled
  on public.blog_articles(status, scheduled_at)
  where status = 'scheduled';

create index if not exists idx_blog_articles_category
  on public.blog_articles(category_id, status, published_at desc);

create index if not exists idx_blog_article_tags_tag
  on public.blog_article_tags(tag_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.blog_tags enable row level security;
alter table public.blog_article_tags enable row level security;

create policy "blog_tags public read" on public.blog_tags
  for select using (true);
create policy "blog_tags staff manage" on public.blog_tags
  for all using (app_private.is_staff()) with check (app_private.is_staff());

create policy "blog_article_tags public read" on public.blog_article_tags
  for select using (true);
create policy "blog_article_tags staff manage" on public.blog_article_tags
  for all using (app_private.is_staff()) with check (app_private.is_staff());

-- ── Publishing cron helper ───────────────────────────────────────────────────
-- Called by cron or a server action to flip SCHEDULED → PUBLISHED when due.
create or replace function public.publish_scheduled_articles()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  rows_updated integer;
begin
  update public.blog_articles
    set status       = 'published',
        published_at = scheduled_at,
        updated_at   = now()
  where status       = 'scheduled'
    and scheduled_at <= now();
  get diagnostics rows_updated = row_count;
  return rows_updated;
end;
$$;
