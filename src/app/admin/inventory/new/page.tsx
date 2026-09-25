import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { VehicleForm } from "@/components/admin/vehicle-form";
import { createVehicle } from "@/app/admin/inventory/actions";
import { getMakes, getAllModels, getAllFeatures } from "@/lib/data/inventory";
import { getActiveLocations } from "@/lib/data/locations";
import { requirePermission } from "@/lib/security/auth";

export const metadata = { title: "Add Vehicle" };
export const dynamic = "force-dynamic";

export default async function NewVehiclePage() {
  await requirePermission("inventory.write");
  const [makes, models, features, locations] = await Promise.all([
    getMakes(), getAllModels(), getAllFeatures(), getActiveLocations(),
  ]);

  return (
    <div className="max-w-4xl space-y-6">
      <Link href="/admin/inventory" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Back to inventory</Link>
      <h1 className="font-heading text-2xl font-bold text-foreground">Add a vehicle</h1>
      <VehicleForm action={createVehicle} makes={makes} models={models} features={features} locations={locations} mode="create" />
    </div>
  );
}
