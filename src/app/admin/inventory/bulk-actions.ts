"use server";

import { revalidateTag, revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/security/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import * as xlsx from "xlsx";
import { vehicleCsvRowSchema } from "@/lib/validation/vehicle";

/* eslint-disable @typescript-eslint/no-explicit-any */

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function uniqueSlug(base: string) {
  return `${slugify(base)}-${Math.random().toString(36).substring(2, 6)}`;
}

const MAX_UPLOAD_SIZE_BYTES = 8 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = new Set(["csv", "xlsx", "xls"]);

export async function processBulkUpload(formData: FormData) {
  try {
    const user = await requireAdmin();
    const fileValue = formData.get("file");

    if (!(fileValue instanceof File)) {
      return { success: false, error: "Missing file" };
    }

    const file = fileValue;
    const extension = file.name.split(".").pop()?.toLowerCase();

    if (!extension || !SUPPORTED_EXTENSIONS.has(extension)) {
      return { success: false, error: "Unsupported file type. Upload a CSV, XLSX, or XLS file." };
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return { success: false, error: "The uploaded file is too large. Please upload a file smaller than 8 MB." };
    }

    const supabase = createAdminClient();

    // Read the file using xlsx
    const buffer = await file.arrayBuffer();
    const workbook = xlsx.read(buffer, { type: "array", cellDates: false });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      return { success: false, error: "The uploaded file does not contain any sheets." };
    }

    const worksheet = workbook.Sheets[firstSheetName];
    
    // Convert to JSON
    const rows = xlsx.utils.sheet_to_json(worksheet) as any[];

    if (rows.length === 0) {
      return { success: false, error: "The uploaded file is empty." };
    }

    const parsedRows: any[] = [];

    const transmissionMap: Record<string, string> = {
      "auto": "automatic",
      "automatic": "automatic",
      "manual": "manual",
      "cvt": "cvt",
      "dct": "dct"
    };

    const driveTypeMap: Record<string, string> = {
      "fwd": "fwd",
      "front wheel drive": "fwd",
      "rwd": "rwd",
      "rear wheel drive": "rwd",
      "awd": "awd",
      "all wheel drive": "awd",
      "four_wd": "four_wd",
      "4wd": "four_wd",
      "4x4": "four_wd",
      "4x2": "rwd",
      "front": "fwd",
      "rear": "rwd"
    };

    const bodyTypeMap: Record<string, string> = {
      "sedan": "sedan",
      "hatch": "hatch",
      "hatchback": "hatch",
      "suv": "suv",
      "ute": "ute",
      "utility": "ute",
      "wagon": "wagon",
      "coupe": "coupe",
      "convertible": "convertible",
      "cabriolet": "convertible",
      "van": "van",
      "people_mover": "people_mover",
      "people mover": "people_mover"
    };

    const fuelTypeMap: Record<string, string> = {
      "petrol": "petrol",
      "unleaded": "petrol",
      "premium": "petrol",
      "diesel": "diesel",
      "hybrid": "hybrid",
      "phev": "phev",
      "plug-in hybrid": "phev",
      "electric": "electric",
      "ev": "electric",
      "lpg": "lpg"
    };

    // Helper to format generic date strings (DD/MM/YYYY or DD-MM-YYYY) to YYYY-MM-DD
    function parseDateToIso(dateStr: string | undefined): string | undefined {
      if (!dateStr) return undefined;
      const str = String(dateStr).trim();
      if (!str) return undefined;
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
      const parts = str.split(/[\/\-]/);
      if (parts.length === 3) {
        const [p1, p2, p3] = parts;
        if (p3.length === 4) {
          return `${p3}-${p2.padStart(2, "0")}-${p1.padStart(2, "0")}`;
        }
      }
      return str;
    }

    // 1. Parse and validate rows.
    //    lenientEnum in vehicleCsvRowSchema silently clears unknown enum values,
    //    so rows almost never fail here. Only rows with missing Stock ID / Make /
    //    Model or an invalid price are skipped; everything else is imported.
    const skippedRows: string[] = [];

    rows.forEach((rawRow, index) => {
      const row: Record<string, any> = {};
      for (const [k, v] of Object.entries(rawRow)) {
        const normalizedKey = k.toLowerCase().replace(/[\s_]+/g, "");
        row[normalizedKey] = v;
      }

      const fuelRaw = String(row["fueltype"] || "").toLowerCase().trim();
      const transRaw = String(row["transmission"] || "").toLowerCase().trim();
      const bodyRaw = String(row["bodytype"] || "").toLowerCase().trim();
      const driveRaw = row["drivetype"] ? String(row["drivetype"]).toLowerCase().trim().replace(/\s+/g, " ") : undefined;

      const mapped = {
        stock_id: String(row["stockid"] || ""),
        make: String(row["make"] || ""),
        model: String(row["model"] || ""),
        variant: row["variant"] ? String(row["variant"]) : undefined,
        year: parseInt(String(row["year"] || "0")),
        mileage_km: row["mileagekm"] || row["mileage"] || row["odometer"]
          ? parseInt(String(row["mileagekm"] || row["mileage"] || row["odometer"]))
          : 0,
        fuel_type: fuelTypeMap[fuelRaw] ?? (fuelRaw || undefined),
        transmission: transmissionMap[transRaw] ?? (transRaw || undefined),
        body_type: bodyTypeMap[bodyRaw] ?? (bodyRaw || undefined),
        drive_type: driveRaw ? (driveTypeMap[driveRaw] ?? driveRaw) : undefined,
        price: parseFloat(String(row["price"] || "0")),
        exterior_color: row["exteriorcolor"] || row["color"] ? String(row["exteriorcolor"] || row["color"]) : undefined,
        engine: row["engine"] ? String(row["engine"]) : undefined,
        power_kw: row["powerkw"] || row["power"] ? parseInt(String(row["powerkw"] || row["power"])) : undefined,
        seats: row["seats"] ? parseInt(String(row["seats"])) : undefined,
        doors: row["doors"] ? parseInt(String(row["doors"])) : undefined,
        interior: row["interior"] ? String(row["interior"]) : undefined,
        vin: row["vin"] ? String(row["vin"]) : undefined,
        registration: row["registration"] || row["rego"] ? String(row["registration"] || row["rego"]) : undefined,
        rego_expiry: parseDateToIso(row["regoexpiry"]),
        safety_rating: row["safetyrating"] ? String(row["safetyrating"]) : undefined,
        warranty_text: row["warranty"] || row["warrantytext"] ? String(row["warranty"] || row["warrantytext"]) : undefined,
        description: row["description"] ? String(row["description"]) : undefined,
      };

      const parsed = vehicleCsvRowSchema.safeParse(mapped);

      if (!parsed.success) {
        skippedRows.push(`Row ${index + 2}: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
        return;
      }

      parsedRows.push(parsed.data);
    });

    if (parsedRows.length === 0) {
      return { success: false, errors: skippedRows };
    }

    // 2. Resolve Makes and Models
    const makeNames = [...new Set(parsedRows.map((r) => r.make))];
    const makesMap = new Map<string, string>(); // slug -> id
    const modelsMap = new Map<string, string>(); // makeId_modelSlug -> id

    // Fetch existing makes
    const { data: existingMakes } = await supabase.from("makes").select("id, slug");
    if (existingMakes) {
      existingMakes.forEach((m) => makesMap.set(m.slug, m.id));
    }

    for (const makeName of makeNames) {
      const makeSlug = slugify(makeName);
      if (!makesMap.has(makeSlug)) {
        const { data: newMake } = await supabase.from("makes").insert({ name: makeName, slug: makeSlug }).select("id").single();
        if (newMake) {
          makesMap.set(makeSlug, newMake.id);
        }
      }
    }

    // Fetch existing models for all these makes
    const { data: existingModels } = await supabase.from("models").select("id, make_id, slug");
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
        const { data: newModel } = await supabase.from("models").insert({ make_id: makeId, name: r.model, slug: modelSlug }).select("id").single();
        if (newModel) {
          modelsMap.set(modelKey, newModel.id);
        }
      }
    }

    // 3. Build inserts for vehicles table
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
        fuel_type: r.fuel_type,
        transmission: r.transmission,
        body_type: r.body_type,
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
        status: "draft", // Imported vehicles start as draft
        published_at: null,
      };
    });

    if (inserts.length > 0) {
      const CHUNK_SIZE = 200;
      let insertedCount = 0;
      
      for (let i = 0; i < inserts.length; i += CHUNK_SIZE) {
        const chunk = inserts.slice(i, i + CHUNK_SIZE);
        const { error, count } = await supabase.from("vehicles").insert(chunk);
        
        if (error) {
          return { success: false, error: `Database error during bulk insert (batch ${Math.floor(i / CHUNK_SIZE) + 1}): ` + error.message };
        }
        
        insertedCount += chunk.length;
      }
      
      // Fire-and-forget activity log
      supabase.from("activity_logs")
        .insert({ user_id: user.id, action: "vehicle.bulk_created", entity_type: "organization", entity_id: "admin", diff: { count: inserts.length } })
        .then(() => { /* no-op */ });
    }

    const revalidate = revalidateTag as (tag: string) => void;
    revalidate("vehicles");
    revalidate("public");
    revalidatePath("/admin/inventory");

    return { 
      success: true, 
      count: inserts.length,
      skipped: skippedRows.length,
    };

  } catch (error) {
    console.error("Bulk upload error:", error);
    return { success: false, error: "An unexpected error occurred processing the file." };
  }
}
