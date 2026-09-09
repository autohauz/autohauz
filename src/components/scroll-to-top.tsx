"use client";

import { useState, useEffect } from "react";
import { ChevronUp } from "lucide-react";
import { useScrollPosition } from "@/hooks/use-scroll-position";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useMobileState } from "@/components/mobile-state-provider";

/**
 * Floating scroll-to-top button that appears after scrolling
 * past 2× the viewport height. Respects reduced motion preference.
 *
 * Positioning / layering:
 * - Sits in the same floating layer as the WhatsApp button
 *   (`--z-whatsapp`, z-50) which is below the mobile nav (z-60) and
 *   modals (z-70), so it can never obscure or be obscured by them.
 * - Stacks directly above the WhatsApp float (and therefore above the
 *   sticky CTA bar when it is visible) so the two floating buttons never
 *   overlap on mobile.
 * - Hides entirely while the mobile nav drawer or a modal is open, matching
 *   the WhatsApp button behaviour, to avoid interaction conflicts.
 *
 * @validates Requirements 16.4, 11.2, 13.4
 */
export function ScrollToTop() {
  const scrollY = useScrollPosition();
  const prefersReduced = useReducedMotion();
  const { isStickyCtaVisible, isMobileNavOpen, isModalOpen } = useMobileState();
  const [viewportHeight, setViewportHeight] = useState(0);

  useEffect(() => {
    setViewportHeight(window.innerHeight);
    const handleResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener("resize", handleResize, { passive: true });
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Visibility threshold (Property 7): visible iff scrollY > 2 * vh.
  // Always hidden while an overlay (mobile nav / modal) is open so it never
  // conflicts with those higher layers.
  const isVisible =
    viewportHeight > 0 &&
    scrollY > 2 * viewportHeight &&
    !isMobileNavOpen &&
    !isModalOpen;

  const handleClick = () => {
    window.scrollTo({
      top: 0,
      behavior: prefersReduced ? "instant" : "smooth",
    });
  };

  // Stack ~64px above the WhatsApp float (its ~52px height + 12px gap) so the
  // two never overlap. When the sticky CTA is visible on mobile, the WhatsApp
  // float lifts above the bar and this button lifts with it.
  const bottomClass = isStickyCtaVisible
    ? "bottom-[calc(var(--sticky-cta-height,44px)+12px+24px+64px+env(safe-area-inset-bottom))] lg:bottom-[calc(24px+64px+env(safe-area-inset-bottom))]"
    : "bottom-[calc(24px+64px+env(safe-area-inset-bottom))]";

  return (
    <button
      onClick={handleClick}
      aria-label="Scroll to top"
      className={`fixed right-6 z-[var(--z-whatsapp,50)] flex items-center justify-center
        w-11 h-11 rounded-full bg-orange-600 text-white shadow-lg
        hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2
        min-w-[44px] min-h-[44px]
        ${bottomClass}
        ${prefersReduced ? "" : "transition-[opacity,transform] duration-300 ease-out"}
        ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}`}
    >
      <ChevronUp className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
