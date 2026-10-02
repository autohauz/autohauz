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
 * Premium Vehicle card.
 *
 * Designed with a subtle hover-lift and deep shadow to feel tactile and high-end.
 * The title link stretches over the card to ensure one tab stop, keeping accessibility pristine.
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
        "group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2",
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
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5 z-10">
          {sold ? (
            <Badge variant="neutral" className="shadow-sm font-bold tracking-wide">Sold</Badge>
          ) : v.status === "reserved" ? (
            <Badge variant="warning" className="shadow-sm font-bold tracking-wide">Reserved</Badge>
          ) : v.isNewArrival ? (
            <Badge variant="info" className="shadow-sm font-bold tracking-wide">New Arrival</Badge>
          ) : null}
          {v.isFeatured && !sold ? <Badge variant="solid" className="shadow-sm bg-accent text-white font-bold tracking-wide">Featured</Badge> : null}
        </div>
        <FavoriteButton vehicleId={v.id} className="absolute right-3 top-3 z-10 transition-transform duration-200 hover:scale-110" label={`Save ${title}`} />
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div>
          <h3 className="text-lg font-bold leading-tight tracking-tight text-foreground transition-colors group-hover:text-accent">
            <Link href={href} className="after:absolute after:inset-0 after:content-['']">
              {title}
            </Link>
          </h3>
          {v.variant ? <p className="mt-1 truncate text-sm font-medium text-muted-foreground">{v.variant}</p> : null}
        </div>

        <ul className="flex flex-wrap text-sm font-medium text-muted-foreground [&>li+li]:ml-3 [&>li+li]:border-l [&>li+li]:border-border [&>li+li]:pl-3">
          <li className="tabular">{formatKm(v.mileageKm)}</li>
          <li>{TRANSMISSION_LABELS[v.transmission]}</li>
          <li>{FUEL_LABELS[v.fuelType]}</li>
        </ul>

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-border/50 pt-4">
          <div>
            <p className="price text-2xl font-black tracking-tight text-foreground">
              {formatPrice(v.price)}
              {reduced ? (
                <span className="ml-2 text-sm font-medium text-muted-foreground line-through" aria-label={`was ${formatPrice(v.previousPrice!)}`}>
                  {formatPrice(v.previousPrice!)}
                </span>
              ) : null}
            </p>
            {v.weeklyEstimate ? (
              <p className="mt-1 text-xs font-semibold text-muted-foreground">
                From <span className="tabular font-bold text-accent">{formatPrice(v.weeklyEstimate)}</span>/week*
              </p>
            ) : null}
          </div>
          {v.city ? (
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <MapPin className="size-4 text-accent/70" aria-hidden="true" />
              {v.city}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
