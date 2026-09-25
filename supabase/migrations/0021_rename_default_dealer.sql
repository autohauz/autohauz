-- ─────────────────────────────────────────────────────────────────────────────
-- 0021  Rename the default syndication dealer to AutoHauz
--
-- Databases created before 0014 seeded the AutoHauz dealer may still hold an
-- older default dealer. The code is used as an identifier in feed tokens and
-- channel payloads, and the display name appears in channel consoles, so both
-- must reflect the brand. Idempotent; a no-op when the row is already correct.
-- ─────────────────────────────────────────────────────────────────────────────

update public.syndication_dealer
set code = 'autohauz',
    display_name = 'AutoHauz'
where is_default = true
  and (code <> 'autohauz' or display_name <> 'AutoHauz');
