import { useEffect, useState, useRef } from "react";

/**
 * Tracks window.scrollY using a throttled scroll listener (~100ms via rAF).
 * Returns the current vertical scroll position.
 *
 * @validates Requirements 16.4
 */
export function useScrollPosition(): number {
  const [scrollY, setScrollY] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (rafRef.current !== null) return;

      rafRef.current = requestAnimationFrame(() => {
        setScrollY(window.scrollY);
        rafRef.current = null;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return scrollY;
}
