import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mediaQuery = window.matchMedia(QUERY);
  mediaQuery.addEventListener("change", onChange);
  return () => mediaQuery.removeEventListener("change", onChange);
}

function getSnapshot() {
  return typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(QUERY).matches;
}

// Server render and first client paint agree on `false`, so there is no
// hydration mismatch; the real preference is read synchronously on mount.
function getServerSnapshot() {
  return false;
}

/**
 * Detects the user's OS-level `prefers-reduced-motion` preference and updates
 * reactively when it changes. Returns `false` during SSR.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
