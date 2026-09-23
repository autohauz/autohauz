"use client";

import { useSyncExternalStore, useCallback } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

const KEY = "uc_favorites";
const EVENT = "uc:favorites-changed";

function readFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || "[]") as string[];
  } catch {
    return [];
  }
}

function writeFavorites(ids: string[]) {
  window.localStorage.setItem(KEY, JSON.stringify(ids));
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Heart toggle backed by localStorage — no login (SRS FR-23). */
export function FavoriteButton({
  vehicleId,
  className,
  label,
}: {
  vehicleId: string;
  className?: string;
  label?: string;
}) {
  // useSyncExternalStore keeps us hydration-safe (server snapshot = false) and
  // in sync across cards/tabs without setState-in-effect.
  const active = useSyncExternalStore(
    subscribe,
    useCallback(() => readFavorites().includes(vehicleId), [vehicleId]),
    () => false,
  );

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const ids = readFavorites();
    writeFavorites(ids.includes(vehicleId) ? ids.filter((id) => id !== vehicleId) : [...ids, vehicleId]);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={active}
      aria-label={label ? (active ? `Remove ${label.replace(/^Save /, "")} from saved` : label) : active ? "Remove from saved" : "Save this car"}
      className={cn(
        "inline-flex size-10 items-center justify-center rounded-full border border-border bg-card/90 text-card-foreground shadow-card backdrop-blur-[2px] transition-colors duration-150 hover:bg-card",
        className,
      )}
    >
      <Heart className={cn("size-5", active ? "fill-danger stroke-danger" : "stroke-current")} aria-hidden="true" />
    </button>
  );
}
