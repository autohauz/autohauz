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

    const errors: string[] = [];
    const parsedRows: any[] = [];

    // 1. Parse and validate rows
    rows.forEach((row, index) => {
      // Map columns based on our template
      const mapped = {
        stock_id: String(row["Stock ID"] || row["stock_id"] || ""),
        make: String(row["Make"] || row["make"] || ""),
        model: String(row["Model"] || row["model"] || ""),
        variant: row["Variant"] ? String(row["Variant"]) : undefined,
        year: parseInt(row["Year"] || row["year"] || "0"),
        mileage_km: parseInt(row["Mileage (km)"] || row["mileage_km"] || "0"),
        fuel_type: String(row["Fuel Type"] || row["fuel_type"] || "").toLowerCase(),
        transmission: String(row["Transmission"] || row["transmission"] || "").toLowerCase(),
        body_type: String(row["Body Type"] || row["body_type"] || "").toLowerCase(),
        drive_type: row["Drive Type"] ? String(row["Drive Type"]).toLowerCase() : undefined,
        price: parseFloat(row["Price"] || row["price"] || "0"),
        exterior_color: row["Exterior Color"] ? String(row["Exterior Color"]) : undefined,
        description: row["Description"] ? String(row["Description"]) : undefined,
      };

      const parsed = vehicleCsvRowSchema.safeParse(mapped);

      if (!parsed.success) {
        errors.push(`Row ${index + 2}: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
        return;
      }

      parsedRows.push(parsed.data);
    });

    if (errors.length > 0) {
      return { success: false, errors };
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

    revalidateTag("vehicles");
    revalidateTag("public");
    revalidatePath("/admin/inventory");

    return { 
      success: true, 
      count: inserts.length,
    };

  } catch (error) {
    console.error("Bulk upload error:", error);
    return { success: false, error: "An unexpected error occurred processing the file." };
  }
}
