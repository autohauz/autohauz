"use client";

import { MapPin } from "lucide-react";

/**
 * Click-to-load Google Map link.
 */
export function MapEmbed({ address }: { address: string }) {
  const mapUrl = "https://maps.app.goo.gl/tteBK4xGkyq7zKye7";

  return (
    <a
      href={mapUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-60 w-full flex-col items-center justify-center gap-2 rounded-md border border-border bg-muted text-sm font-semibold text-foreground transition-colors hover:bg-muted/70"
    >
      <MapPin className="size-6 text-accent-bright" aria-hidden="true" />
      View on Google Maps
      <span className="text-xs font-normal text-muted-foreground">Opens in new tab</span>
    </a>
  );
}
