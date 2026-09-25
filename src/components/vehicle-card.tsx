import Link from "next/link";
import { MapPin } from "lucide-react";
import type { VehicleListItem } from "@/lib/domain";
import { FUEL_LABELS, TRANSMISSION_LABELS, formatKm, formatPrice } from "@/lib/nav";
import { VEHICLE_PLACEHOLDER } from "@/lib/media";
import { Badge } from "@/components/ui/badge";
import { FavoriteButton } from "@/components/favorite-button";
import { VehicleCardGallery } from "@/components/vehicle-card-gallery";
import { cn } from "@/lib/utils";

/**
 * Vehicle card — DESIGN.md §6.
 *
 * The whole card is one link target (the title link is stretched over the
 * card with a pseudo-element), so keyboard users get one tab stop per car and
 * the only other interactive element, the favourite button, sits above it.
 * Photo first, then the facts a buyer scans for: what it is, the three numbers
 * that matter (km, gearbox, fuel), the price. No hover-lift.
 */
export function VehicleCard({ vehicle: v, priority = false, className }: { vehicle: VehicleListItem; priority?: boolean; className?: string }) {
  const title = `${v.year} ${v.makeName} ${v.modelName}`;
  const href = `/used-cars/${v.makeSlug}/${v.modelSlug}/${v.slug}`;
  const image = v.coverImageUrl || VEHICLE_PLACEHOLDER;
  const alt = v.coverImageAlt || `${title}${v.variant ? ` ${v.variant}` : ""} for sale`;
  const sold = v.status === "sold";
  const reduced = v.previousPrice != null && v.previousPrice > v.price;

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-card transition-colors duration-150 focus-within:border-accent-bright hover:border-accent-bright",
        className,
      )}
    >
      <div className="relative overflow-hidden bg-muted">
        <VehicleCardGallery 
          coverImage={image} 
          alt={alt} 
          images={v.imageUrls} 
          priority={priority} 
          sold={sold} 
        />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {sold ? (
            <Badge variant="neutral">Sold</Badge>
          ) : v.status === "reserved" ? (
            <Badge variant="warning">Reserved</Badge>
          ) : v.isNewArrival ? (
            <Badge variant="info">New arrival</Badge>
          ) : null}
          {v.isFeatured && !sold ? <Badge variant="solid">Featured</Badge> : null}
        </div>
        <FavoriteButton vehicleId={v.id} className="absolute right-3 top-3 z-10" label={`Save ${title}`} />
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="text-base font-semibold leading-snug">
            <Link href={href} className="after:absolute after:inset-0 after:content-['']">
              {title}
            </Link>
          </h3>
          {v.variant ? <p className="mt-0.5 truncate text-sm text-muted-foreground">{v.variant}</p> : null}
        </div>

        <ul className="flex flex-wrap text-sm text-body [&>li+li]:ml-3 [&>li+li]:border-l [&>li+li]:border-border [&>li+li]:pl-3">
          <li className="tabular">{formatKm(v.mileageKm)}</li>
          <li>{TRANSMISSION_LABELS[v.transmission]}</li>
          <li>{FUEL_LABELS[v.fuelType]}</li>
        </ul>

        <div className="mt-auto flex items-end justify-between gap-3">
          <div>
            <p className="price text-xl font-bold leading-none text-foreground">
              {formatPrice(v.price)}
              {reduced ? (
                <span className="ml-2 text-sm font-normal text-muted-foreground line-through" aria-label={`was ${formatPrice(v.previousPrice!)}`}>
                  {formatPrice(v.previousPrice!)}
                </span>
              ) : null}
            </p>
            {v.weeklyEstimate ? (
              <p className="mt-1 text-xs text-muted-foreground">
                From <span className="tabular font-medium text-body">{formatPrice(v.weeklyEstimate)}</span>/week*
              </p>
            ) : null}
          </div>
          {v.city ? (
            <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3.5" aria-hidden="true" />
              {v.city}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
