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
