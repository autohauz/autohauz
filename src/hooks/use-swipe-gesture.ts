import { useEffect, useRef, type RefObject } from "react";

export interface SwipeGestureOptions {
  /** Minimum distance in px to trigger a swipe (default: 50) */
  threshold?: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

/**
 * Detects swipe gestures on a referenced element using PointerEvents.
 * Fires directional callbacks when the swipe distance exceeds the threshold.
 *
 * @validates Requirements 2.1, 3.5
 */
export function useSwipeGesture(
  ref: RefObject<HTMLElement | null>,
  options: SwipeGestureOptions
): void {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let startX = 0;
    let startY = 0;
    let tracking = false;

    const handlePointerDown = (e: PointerEvent) => {
      startX = e.clientX;
      startY = e.clientY;
      tracking = true;
    };

    const handlePointerMove = () => {
      if (!tracking) return;
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!tracking) return;
      tracking = false;

      const threshold = optionsRef.current.threshold ?? 50;
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      // Determine primary axis
      if (absDeltaX > absDeltaY) {
        // Horizontal swipe
        if (absDeltaX >= threshold) {
          if (deltaX < 0) {
            optionsRef.current.onSwipeLeft?.();
          } else {
            optionsRef.current.onSwipeRight?.();
          }
        }
      } else {
        // Vertical swipe
        if (absDeltaY >= threshold) {
          if (deltaY < 0) {
            optionsRef.current.onSwipeUp?.();
          } else {
            optionsRef.current.onSwipeDown?.();
          }
        }
      }
    };

    const handlePointerCancel = () => {
      tracking = false;
    };

    element.addEventListener("pointerdown", handlePointerDown);
    element.addEventListener("pointermove", handlePointerMove);
    element.addEventListener("pointerup", handlePointerUp);
    element.addEventListener("pointercancel", handlePointerCancel);

    return () => {
      element.removeEventListener("pointerdown", handlePointerDown);
      element.removeEventListener("pointermove", handlePointerMove);
      element.removeEventListener("pointerup", handlePointerUp);
      element.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [ref]);
}
