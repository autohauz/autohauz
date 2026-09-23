#!/usr/bin/env node
/**
 * Development seed: a dozen realistic vehicles so the listing, landing pages
 * and vehicle detail page can be exercised against real queries.
 *
 * Deliberately opt-in and reversible:
 *   node --env-file=.env scripts/dev/seed-vehicles.mjs            # dry run: shows the target project
 *   SEED_CONFIRM=1 node --env-file=.env scripts/dev/seed-vehicles.mjs    # writes
 *   SEED_CONFIRM=1 node --env-file=.env scripts/dev/seed-vehicles.mjs --clean   # removes DEV- rows
 *
 * Every row it writes has stock_id prefixed "DEV-" and dealer_notes = "DEV SEED",
 * so `--clean` removes exactly what this script created and nothing else.
 * Needs the makes/models from supabase/migrations/0010_seed.sql. No images are
 * uploaded (the site's placeholder renders instead).
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (run with --env-file=.env).");
  process.exit(1);
}
const clean = process.argv.includes("--clean");
const confirmed = process.env.SEED_CONFIRM === "1";
console.log(`Target project: ${new URL(url).host}${clean ? " (clean)" : ""}`);
if (!confirmed) {
  console.log("Dry run. Re-run with SEED_CONFIRM=1 to write.");
  process.exit(0);
}

const db = createClient(url, key, { auth: { persistSession: false } });

if (clean) {
  const { data, error } = await db.from("vehicles").delete().like("stock_id", "DEV-%").select("stock_id");
  if (error) throw error;
  console.log(`Removed ${data.length} dev vehicles.`);
  process.exit(0);
}

const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString();

/** make, model, variant, year, km, fuel, transmission, body, drive, price, previous, colour, engine, seats, doors, status, featured, publishedDaysAgo */
const CARS = [
  ["toyota", "corolla", "Ascent Sport Hatch", 2021, 38_400, "petrol", "cvt", "hatch", "fwd", 27_990, 29_490, "Glacier White", "2.0L 4cyl", 5, 5, "available", true, 2],
  ["toyota", "rav4", "GXL Hybrid AWD", 2022, 41_200, "hybrid", "cvt", "suv", "awd", 46_990, null, "Silver Sky", "2.5L hybrid", 5, 5, "available", true, 5],
  ["toyota", "hilux", "SR5 Double Cab 4x4", 2020, 88_900, "diesel", "automatic", "ute", "four_wd", 49_500, null, "Graphite", "2.8L turbo diesel", 5, 4, "available", true, 12],
  ["toyota", "camry", "Ascent Hybrid", 2019, 96_300, "hybrid", "cvt", "sedan", "fwd", 26_500, 27_990, "Eclipse Black", "2.5L hybrid", 5, 4, "available", false, 20],
  ["mazda", "cx-5", "Maxx Sport", 2021, 52_700, "petrol", "automatic", "suv", "fwd", 33_990, null, "Soul Red Crystal", "2.5L 4cyl", 5, 5, "available", true, 3],
  ["mazda", "mazda3", "G20 Evolve", 2020, 61_100, "petrol", "automatic", "hatch", "fwd", 24_990, null, "Polymetal Grey", "2.0L 4cyl", 5, 5, "available", false, 8],
  ["hyundai", "i30", "Active", 2019, 74_800, "petrol", "automatic", "hatch", "fwd", 19_990, 21_490, "Fiery Red", "2.0L 4cyl", 5, 5, "available", false, 15],
  ["hyundai", "tucson", "Elite AWD", 2022, 29_600, "petrol", "dct", "suv", "awd", 41_990, null, "Deep Sea", "1.6L turbo", 5, 5, "reserved", false, 6],
  ["ford", "ranger", "XLT Double Cab 4x4", 2021, 67_400, "diesel", "automatic", "ute", "four_wd", 52_990, null, "Arctic White", "2.0L bi-turbo diesel", 5, 4, "available", false, 9],
  ["kia", "sportage", "SX", 2020, 58_200, "petrol", "automatic", "suv", "fwd", 29_990, null, "Sparkling Silver", "2.0L 4cyl", 5, 5, "available", false, 30],
  ["mitsubishi", "outlander", "LS 7 Seat", 2021, 44_900, "petrol", "cvt", "suv", "fwd", 34_990, null, "White Diamond", "2.5L 4cyl", 7, 5, "available", false, 4],
  ["volkswagen", "golf", "110TSI Life", 2021, 36_500, "petrol", "dct", "hatch", "fwd", 31_990, null, "Atlantic Blue", "1.4L turbo", 5, 5, "sold", false, 60],
];

const { data: makes, error: mErr } = await db.from("makes").select("id, slug");
if (mErr) throw mErr;
const { data: models, error: moErr } = await db.from("models").select("id, slug, make_id");
if (moErr) throw moErr;
const { data: location } = await db.from("locations").select("id").eq("is_active", true).limit(1).maybeSingle();

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const rows = [];
CARS.forEach((c, i) => {
  const [makeSlug, modelSlug, variant, year, km, fuel, trans, body, drive, price, previous, colour, engine, seats, doors, status, featured, published] = c;
  const make = makes.find((m) => m.slug === makeSlug);
  const model = models.find((m) => m.make_id === make?.id && m.slug === modelSlug);
  if (!make || !model) {
    console.warn(`Skipping ${makeSlug}/${modelSlug}: apply supabase/migrations/0010_seed.sql first.`);
    return;
  }
  const stockId = `DEV-${String(1001 + i)}`;
  rows.push({
    stock_id: stockId,
    slug: slugify(`${year}-${makeSlug}-${modelSlug}-${variant}-${stockId}`),
    make_id: make.id,
    model_id: model.id,
    variant,
    year,
    mileage_km: km,
    fuel_type: fuel,
    transmission: trans,
    body_type: body,
    drive_type: drive,
    engine,
    seats,
    doors,
    exterior_color: colour,
    interior: "Cloth",
    registration: null,
    price,
    previous_price: previous,
    price_changed_at: previous ? daysAgo(1) : null,
    weekly_estimate: Math.round((price * 0.9 * 0.0036) * 100) / 100,
    description: `${year} ${variant}. One owner, full service history, inspected before listing. Ready to drive away.`,
    safety_rating: "5-star ANCAP",
    warranty_text: "3-month statutory warranty",
    roadworthy_included: true,
    finance_available: true,
    trade_in_welcome: true,
    inspection_available: true,
    status,
    is_featured: featured,
    featured_order: featured ? i + 1 : null,
    location_id: location?.id ?? null,
    dealer_notes: "DEV SEED",
    published_at: daysAgo(published),
    sold_at: status === "sold" ? daysAgo(published - 40) : null,
  });
});

const { data, error } = await db.from("vehicles").upsert(rows, { onConflict: "stock_id" }).select("stock_id, slug, status");
if (error) throw error;
console.log(`Upserted ${data.length} vehicles:`);
for (const v of data) console.log(`  ${v.stock_id}  ${v.status.padEnd(9)}  /used-cars/…/${v.slug}`);
