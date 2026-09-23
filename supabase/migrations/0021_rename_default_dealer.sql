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
