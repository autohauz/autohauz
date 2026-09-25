"use server";

import { getModelsForMake, getAllModels } from "@/lib/data/inventory";

const MAKE_SLUG = /^[a-z0-9-]{1,64}$/;

/** Public: models for the make filter. Reads cached reference data only. */
export async function fetchModels(makeSlug?: string) {
  if (!makeSlug) return getAllModels();
  if (!MAKE_SLUG.test(makeSlug)) return [];
  return getModelsForMake(makeSlug);
}
