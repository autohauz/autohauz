"use server";

import { getModelsForMake, getAllModels } from "@/lib/data/inventory";

export async function fetchModels(makeSlug?: string) {
  if (!makeSlug) return await getAllModels();
  return await getModelsForMake(makeSlug);
}
