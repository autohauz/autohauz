import { useEffect, useState } from "react";

/**
 * Detects the user's OS-level `prefers-reduced-motion` preference.
 * Returns `true` if reduced motion is preferred or if matchMedia is unavailable.
 * Listens for changes and updates state reactively.
 *
 * @validates Requirements 11.2
 */
export function useReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReduced(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReduced(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  return prefersReduced;
}
