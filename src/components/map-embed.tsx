"use client";

import { MapPin } from "lucide-react";

/**
 * Click-to-load Google Map link.
 */
export function MapEmbed({ address }: { address: string }) {
  const query = encodeURIComponent(address);
  // Using the standard embed URL format which works without a dedicated API key for basic place markers
  const mapUrl = `https://maps.google.com/maps?q=${query}&t=&z=14&ie=UTF8&iwloc=&output=embed`;

  return (
    <div className="relative h-60 w-full overflow-hidden rounded-xl border border-border shadow-sm group">
      <iframe
        title={`Google Maps showing ${address}`}
        className="absolute inset-0 h-full w-full border-0"
        src={mapUrl}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      {/* Invisible overlay link to still allow the entire block to act as a map link if desired, or let users interact with the iframe */}
    </div>
  );
}
