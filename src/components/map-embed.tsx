"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";

/**
 * Click-to-load Google Map. The embed sets third-party cookies and pulls in
 * ~1 MB of script, so nothing is requested from Google until the visitor asks.
 */
export function MapEmbed({ address }: { address: string }) {
  const [open, setOpen] = useState(false);

  if (open) {
    return (
      <iframe
        title={`Map of ${address}`}
        className="h-60 w-full rounded-md border border-border"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
        src={`https://maps.google.com/maps?q=${encodeURIComponent(address)}&z=14&output=embed`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="flex h-60 w-full flex-col items-center justify-center gap-2 rounded-md border border-border bg-muted text-sm font-semibold text-foreground transition-colors hover:bg-muted/70"
    >
      <MapPin className="size-6 text-accent-bright" aria-hidden="true" />
      Show map
      <span className="text-xs font-normal text-muted-foreground">Loads Google Maps</span>
    </button>
  );
}
