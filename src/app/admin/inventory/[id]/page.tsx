import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { VehicleForm } from "@/components/admin/vehicle-form";
import { updateVehicle } from "@/app/admin/inventory/actions";
import { getMakes, getAllModels, getAllFeatures } from "@/lib/data/inventory";
import { getActiveLocations } from "@/lib/data/locations";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Edit Vehicle" };
export const dynamic = "force-dynamic";

export default async function EditVehiclePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const id = resolvedParams.id;
  const created = resolvedSearchParams?.created;
  const supabase = createAdminClient();

  const [
    { data: vehicle },
    { data: featureRows },
    { data: imageRows },
    makes, models, features, locations,
  ] = await Promise.all([
    supabase.from("vehicles").select("*, makes:make_id(slug), models:model_id(slug)").eq("id", id).maybeSingle(),
    supabase.from("vehicle_features").select("feature_id").eq("vehicle_id", id),
    supabase
      .from("vehicle_images")
      .select("is_cover, sort_order, media:media_id(storage_key)")
      .eq("vehicle_id", id)
      .order("sort_order", { ascending: true }),
    getMakes(), getAllModels(), getAllFeatures(), getActiveLocations(),
  ]);
  if (!vehicle) notFound();

  // Build public URLs for each image using the storage key.
  const storageClient = createAdminClient();
  const images = (imageRows ?? [])
    .map((row) => {
      const rel = row.media as { storage_key?: string } | { storage_key?: string }[] | null;
      const media = Array.isArray(rel) ? rel[0] : rel;
      const storageKey = media?.storage_key ?? "";
      if (!storageKey) return null;
      const { data: urlData } = storageClient.storage.from("media").getPublicUrl(storageKey);
      return {
        media: { storage_key: storageKey, url: urlData.publicUrl },
        is_cover: row.is_cover,
      };
    })
    .filter((x): x is { media: { storage_key: string; url: string }; is_cover: boolean } => x !== null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v = { ...(vehicle as any), images };
  const selectedFeatureIds = ((featureRows ?? []) as { feature_id: string }[]).map((f) => f.feature_id);
  const vdpPath = `/used-cars/${v.makes?.slug}/${v.models?.slug}/${v.slug}`;

  return (
    <div className="max-w-4xl space-y-6">
      <Link href="/admin/inventory" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Back to inventory</Link>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">{v.year} — Stock #{v.stock_id}</h1>
          {created ? <p className="text-sm text-success">Vehicle created.</p> : null}
        </div>
        {v.status !== "draft" ? (
          <a href={vdpPath} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted">
            View live <ExternalLink className="size-4" />
          </a>
        ) : null}
      </div>
      <VehicleForm key={id} action={updateVehicle} makes={makes} models={models} features={features} locations={locations} vehicle={v} selectedFeatureIds={selectedFeatureIds} mode="edit" />
    </div>
  );
}

