import { useEffect, useState, useRef, type RefObject } from "react";

export interface PinchZoomState {
  scale: number;
  origin: { x: number; y: number };
  /** True while a two-finger pinch gesture is actively in progress. */
  isPinching: boolean;
}

export interface PinchZoomOptions {
  /** Minimum allowed scale (default: 1) */
  minScale?: number;
  /** Maximum allowed scale (default: 3) */
  maxScale?: number;
}

/**
 * Tracks two-finger pinch gestures on a referenced element.
 * Returns clamped scale and pinch origin point.
 *
 * @validates Requirements 2.2
 */
export function usePinchZoom(
  ref: RefObject<HTMLElement | null>,
  options?: PinchZoomOptions
): PinchZoomState {
  const minScale = options?.minScale ?? 1;
  const maxScale = options?.maxScale ?? 3;

  const [state, setState] = useState<PinchZoomState>({
    scale: minScale,
    origin: { x: 0, y: 0 },
    isPinching: false,
  });

  const initialDistanceRef = useRef<number | null>(null);
  const baseScaleRef = useRef(minScale);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    function getDistance(touches: TouchList): number {
      const [t1, t2] = [touches[0], touches[1]];
      const dx = t2.clientX - t1.clientX;
      const dy = t2.clientY - t1.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    // Midpoint of the two touches, relative to the element's box so it can be
    // used directly as `transform-origin`.
    function getOrigin(touches: TouchList): { x: number; y: number } {
      const [t1, t2] = [touches[0], touches[1]];
      const rect = element!.getBoundingClientRect();
      return {
        x: (t1.clientX + t2.clientX) / 2 - rect.left,
        y: (t1.clientY + t2.clientY) / 2 - rect.top,
      };
    }

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        initialDistanceRef.current = getDistance(e.touches);
        baseScaleRef.current = state.scale;
        setState((prev) => ({ ...prev, isPinching: true }));
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialDistanceRef.current !== null) {
        e.preventDefault();
        const currentDistance = getDistance(e.touches);
        const ratio = currentDistance / initialDistanceRef.current;
        const newScale = Math.min(
          maxScale,
          Math.max(minScale, baseScaleRef.current * ratio)
        );
        const origin = getOrigin(e.touches);

        setState({ scale: newScale, origin, isPinching: true });
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        initialDistanceRef.current = null;
        setState((prev) => ({ ...prev, isPinching: false }));
      }
    };

    element.addEventListener("touchstart", handleTouchStart, { passive: false });
    element.addEventListener("touchmove", handleTouchMove, { passive: false });
    element.addEventListener("touchend", handleTouchEnd);

    return () => {
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchmove", handleTouchMove);
      element.removeEventListener("touchend", handleTouchEnd);
    };
  }, [ref, minScale, maxScale, state.scale]);

  return state;
}
