import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import * as xlsx from "xlsx";
import { vehicleCsvRowSchema } from "@/lib/validation/vehicle";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Allow up to 10MB on this API route. Vercel Serverless limits apply per-plan,
// but an API route bypasses the Server Action 4.5MB middleware restriction.
export const runtime = "nodejs";
export const maxDuration = 60;

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function uniqueSlug(base: string) {
  return `${slugify(base)}-${Math.random().toString(36).substring(2, 6)}`;
}

const transmissionMap: Record<string, string> = {
  auto: "automatic",
  automatic: "automatic",
  manual: "manual",
  cvt: "cvt",
  dct: "dct",
};

const driveTypeMap: Record<string, string> = {
  fwd: "fwd",
  "front wheel drive": "fwd",
  rwd: "rwd",
  "rear wheel drive": "rwd",
  awd: "awd",
  "all wheel drive": "awd",
  four_wd: "four_wd",
  "4wd": "four_wd",
  "4x4": "four_wd",
  "4x2": "rwd",
  front: "fwd",
  rear: "rwd",
};

const bodyTypeMap: Record<string, string> = {
  sedan: "sedan",
  hatch: "hatch",
  hatchback: "hatch",
  suv: "suv",
  ute: "ute",
  utility: "ute",
  wagon: "wagon",
  coupe: "coupe",
  convertible: "convertible",
  cabriolet: "convertible",
  van: "van",
  people_mover: "people_mover",
  "people mover": "people_mover",
};

const fuelTypeMap: Record<string, string> = {
  petrol: "petrol",
  unleaded: "petrol",
  premium: "petrol",
  diesel: "diesel",
  hybrid: "hybrid",
  phev: "phev",
  "plug-in hybrid": "phev",
  electric: "electric",
  ev: "electric",
  lpg: "lpg",
};

/**
 * Try to parse a date string to YYYY-MM-DD.
 * Returns undefined for anything that isn't a recognisable date so that
 * values like "3 Months Rego" are silently dropped instead of crashing
 * the database insert.
 */
function parseDateToIso(dateStr: string | undefined): string | undefined {
  if (!dateStr) return undefined;
  const str = String(dateStr).trim();
  if (!str) return undefined;

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const d = new Date(str);
    return isNaN(d.getTime()) ? undefined : str;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const parts = str.split(/[\/\-]/);
  if (parts.length === 3) {
    const [p1, p2, p3] = parts;
    if (p3.length === 4 && /^\d+$/.test(p1) && /^\d+$/.test(p2) && /^\d+$/.test(p3)) {
      const iso = `${p3}-${p2.padStart(2, "0")}-${p1.padStart(2, "0")}`;
      const d = new Date(iso);
      return isNaN(d.getTime()) ? undefined : iso;
    }
  }

  // Not a recognisable date — drop it silently
  return undefined;
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate — must be a logged-in admin
    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

    const supabaseAuth = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        },
      },
    });

    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Verify admin role
    const supabaseAdmin = createAdminClient();
    const { data: roleData } = await supabaseAdmin
      .from("admin_roles")
      .select("role, active")
      .eq("user_id", user.id)
      .eq("active", true)
      .maybeSingle();

    if (!roleData) {
      return NextResponse.json({ success: false, error: "Forbidden: Admin role required" }, { status: 403 });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const fileValue = formData.get("file");

    if (!(fileValue instanceof File)) {
      return NextResponse.json({ success: false, error: "Missing file" }, { status: 400 });
    }

    const file = fileValue;
    const extension = file.name.split(".").pop()?.toLowerCase();

    if (!extension || !["csv", "xlsx", "xls"].includes(extension)) {
      return NextResponse.json(
        { success: false, error: "Unsupported file type. Upload a CSV, XLSX, or XLS file." },
        { status: 400 },
      );
    }

    // Read and parse the spreadsheet
    const buffer = await file.arrayBuffer();
    const workbook = xlsx.read(buffer, { type: "array", cellDates: false });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      return NextResponse.json({ success: false, error: "The uploaded file does not contain any sheets." }, { status: 400 });
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const rows = xlsx.utils.sheet_to_json(worksheet) as any[];

    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: "The uploaded file is empty." }, { status: 400 });
    }

    const skippedRows: string[] = [];
    const parsedRows: any[] = [];

    rows.forEach((rawRow, index) => {
      // Normalize keys to lowercase and remove spaces/underscores for robust matching
      const row: Record<string, any> = {};
      for (const [k, v] of Object.entries(rawRow)) {
        const normalizedKey = k.toLowerCase().replace(/[\s_]+/g, "");
        row[normalizedKey] = v;
      }

      const fuelRaw = String(row["fueltype"] || "").toLowerCase().trim();
      const transRaw = String(row["transmission"] || "").toLowerCase().trim();
      const bodyRaw = String(row["bodytype"] || "").toLowerCase().trim();
      const driveRaw = row["drivetype"]
        ? String(row["drivetype"]).toLowerCase().trim().replace(/\s+/g, " ")
        : undefined;

      const mapped = {
        stock_id: String(row["stockid"] || ""),
        make: String(row["make"] || ""),
        model: String(row["model"] || ""),
        variant: row["variant"] ? String(row["variant"]) : undefined,
        year: parseInt(String(row["year"] || "0")),
        mileage_km: row["mileagekm"] || row["mileage"] || row["odometer"]
          ? parseInt(String(row["mileagekm"] || row["mileage"] || row["odometer"]))
          : 0,
        // Pass through mapped or raw values; lenientEnum in the schema clears unknown values
        fuel_type: fuelTypeMap[fuelRaw] ?? (fuelRaw || undefined),
        transmission: transmissionMap[transRaw] ?? (transRaw || undefined),
        body_type: bodyTypeMap[bodyRaw] ?? (bodyRaw || undefined),
        drive_type: driveRaw ? driveTypeMap[driveRaw] ?? driveRaw : undefined,
        price: parseFloat(String(row["price"] || "0")),
        exterior_color: row["exteriorcolor"] || row["color"]
          ? String(row["exteriorcolor"] || row["color"])
          : undefined,
        engine: row["engine"] ? String(row["engine"]) : undefined,
        power_kw:
          row["powerkw"] || row["power"]
            ? parseInt(String(row["powerkw"] || row["power"]))
            : undefined,
        seats: row["seats"] ? parseInt(String(row["seats"])) : undefined,
        doors: row["doors"] ? parseInt(String(row["doors"])) : undefined,
        interior: row["interior"] ? String(row["interior"]) : undefined,
        vin: row["vin"] ? String(row["vin"]) : undefined,
        registration:
          row["registration"] || row["rego"]
            ? String(row["registration"] || row["rego"])
            : undefined,
        rego_expiry: parseDateToIso(row["regoexpiry"]),
        safety_rating: row["safetyrating"] ? String(row["safetyrating"]) : undefined,
        warranty_text:
          row["warranty"] || row["warrantytext"]
            ? String(row["warranty"] || row["warrantytext"])
            : undefined,
        description: row["description"] ? String(row["description"]) : undefined,
      };

      const parsed = vehicleCsvRowSchema.safeParse(mapped);
      if (!parsed.success) {
        // Only truly unrecoverable issues reach here (missing stock_id/make/model, invalid price)
        skippedRows.push(
          `Row ${index + 2}: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
        );
        return; // skip this row, keep going
      }
      parsedRows.push(parsed.data);
    });

    // If every single row was skipped, surface why
    if (parsedRows.length === 0) {
      return NextResponse.json({ success: false, errors: skippedRows }, { status: 422 });
    }

    // Resolve Makes and Models
    const makeNames = [...new Set(parsedRows.map((r) => r.make))];
    const makesMap = new Map<string, string>();
    const modelsMap = new Map<string, string>();

    const { data: existingMakes } = await supabaseAdmin.from("makes").select("id, slug");
    if (existingMakes) {
      existingMakes.forEach((m) => makesMap.set(m.slug, m.id));
    }

    for (const makeName of makeNames) {
      const makeSlug = slugify(makeName);
      if (!makesMap.has(makeSlug)) {
        const { data: newMake } = await supabaseAdmin
          .from("makes")
          .insert({ name: makeName, slug: makeSlug })
          .select("id")
          .single();
        if (newMake) makesMap.set(makeSlug, newMake.id);
      }
    }

    const { data: existingModels } = await supabaseAdmin.from("models").select("id, make_id, slug");
    if (existingModels) {
      existingModels.forEach((m) => modelsMap.set(`${m.make_id}_${m.slug}`, m.id));
    }

    for (const r of parsedRows) {
      const makeSlug = slugify(r.make);
      const makeId = makesMap.get(makeSlug);
      if (!makeId) continue;
      const modelSlug = slugify(r.model);
      const modelKey = `${makeId}_${modelSlug}`;
      if (!modelsMap.has(modelKey)) {
        const { data: newModel } = await supabaseAdmin
          .from("models")
          .insert({ make_id: makeId, name: r.model, slug: modelSlug })
          .select("id")
          .single();
        if (newModel) modelsMap.set(modelKey, newModel.id);
      }
    }

    // Build and insert vehicles
    const inserts = parsedRows.map((r) => {
      const makeSlug = slugify(r.make);
      const makeId = makesMap.get(makeSlug);
      const modelSlug = slugify(r.model);
      const modelId = modelsMap.get(`${makeId}_${modelSlug}`);
      const slug = uniqueSlug(`${r.year}-${makeSlug}-${modelSlug}-${r.variant || ""}-${r.stock_id}`);
      return {
        stock_id: r.stock_id,
        slug,
        make_id: makeId,
        model_id: modelId,
        variant: r.variant || null,
        year: r.year,
        mileage_km: r.mileage_km,
        fuel_type: r.fuel_type ?? "petrol",        // NOT NULL — default to most common
        transmission: r.transmission ?? "automatic", // NOT NULL — default to most common
        body_type: r.body_type ?? "sedan",           // NOT NULL — default to most common
        drive_type: r.drive_type || null,
        price: r.price,
        exterior_color: r.exterior_color || null,
        engine: r.engine || null,
        power_kw: r.power_kw || null,
        seats: r.seats || null,
        doors: r.doors || null,
        interior: r.interior || null,
        vin: r.vin || null,
        registration: r.registration || null,
        rego_expiry: r.rego_expiry || null,
        safety_rating: r.safety_rating || null,
        warranty_text: r.warranty_text || null,
        description: r.description || null,
        status: "draft",
        published_at: null,
      };
    });

    const CHUNK_SIZE = 200;
    for (let i = 0; i < inserts.length; i += CHUNK_SIZE) {
      const chunk = inserts.slice(i, i + CHUNK_SIZE);
      const { error } = await supabaseAdmin.from("vehicles").insert(chunk);
      if (error) {
        return NextResponse.json(
          { success: false, error: `Database error (batch ${Math.floor(i / CHUNK_SIZE) + 1}): ${error.message}` },
          { status: 500 },
        );
      }
    }

    // Fire-and-forget activity log
    supabaseAdmin
      .from("activity_logs")
      .insert({
        user_id: user.id,
        action: "vehicle.bulk_created",
        entity_type: "organization",
        entity_id: "admin",
        diff: { count: inserts.length },
      })
      .then(() => {});

    return NextResponse.json({ success: true, count: inserts.length, skipped: skippedRows.length });
  } catch (err) {
    console.error("Bulk upload API error:", err);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred processing the file." },
      { status: 500 },
    );
  }
}
