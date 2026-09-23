"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Expand, Images, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import type { VehicleImage } from "@/lib/domain";
import { useSwipeGesture } from "@/hooks/use-swipe-gesture";
import { usePinchZoom } from "@/hooks/use-pinch-zoom";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Vehicle photo gallery — DESIGN.md §7.
 *
 * Stage on navy-950 with `object-contain` so photos of any ratio show whole;
 * swipe (pointer) and arrow keys move between photos; thumbnails scroll the
 * active one into view; "View photos" opens a full-screen lightbox with pinch
 * zoom on touch screens. The stage is a `group` with a live-region counter so
 * screen readers hear "Photo 3 of 12" as it changes.
 */
export function VehicleGallery({ images, title, sold = false }: { images: VehicleImage[]; title: string; sold?: boolean }) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const count = images.length;

  const go = useCallback((delta: number) => setIndex((i) => (count ? (i + delta + count) % count : 0)), [count]);
  useSwipeGesture(stageRef, { onSwipeLeft: () => go(1), onSwipeRight: () => go(-1) });

  useEffect(() => {
    const thumb = thumbsRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`);
    thumb?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [index]);

  if (count === 0) return null;
  const active = images[Math.min(index, count - 1)];
  const alt = active.altText ?? `${title} — photo ${index + 1} of ${count}`;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
    } else if (e.key === "Enter") {
      setOpen(true);
    }
  };

  return (
    <div>
      <div
        ref={stageRef}
        role="group"
        aria-roledescription="carousel"
        aria-label={`${title} photos`}
        tabIndex={0}
        onKeyDown={onKey}
        className="relative aspect-[4/3] w-full touch-pan-y overflow-hidden rounded-lg bg-navy-950 sm:aspect-[16/10]"
      >
        <Image
          src={active.url}
          alt={alt}
          fill
          sizes="(max-width: 1024px) 100vw, 60vw"
          className={cn("object-contain select-none", sold && "opacity-80 grayscale-[40%]")}
          priority={index === 0}
          draggable={false}
        />
        {sold ? (
          <div className="absolute left-4 top-4">
            <Badge variant="neutral" className="text-sm">
              Sold
            </Badge>
          </div>
        ) : null}

        <p className="sr-only" aria-live="polite">
          Photo {index + 1} of {count}
        </p>

        {count > 1 ? (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous photo"
              className="absolute left-4 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-[#0a0f1d] text-white shadow-md transition-colors hover:bg-black/80"
            >
              <ChevronLeft className="size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next photo"
              className="absolute right-4 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-[#0a0f1d] text-white shadow-md transition-colors hover:bg-black/80"
            >
              <ChevronRight className="size-5" aria-hidden="true" />
            </button>
          </>
        ) : null}

        <div className="absolute inset-x-4 bottom-4 flex items-end justify-between">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-black/40 px-3 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:bg-black/60 opacity-0 group-hover:opacity-100"
          >
            <Images className="size-4" aria-hidden="true" />
            {count === 1 ? "View photo" : `${count} photos`}
            <Expand className="ml-0.5 size-3.5 opacity-70" aria-hidden="true" />
          </button>
          {count > 1 ? (
            <span className="tabular text-[13px] font-bold text-white tracking-widest" aria-hidden="true">
              {index + 1} / {count}
            </span>
          ) : null}
        </div>
      </div>

      {count > 1 ? (
        <div ref={thumbsRef} className="scrollbar-hide mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Choose a photo">
          {images.map((img, i) => {
            const selected = i === index;
            return (
              <button
                key={img.id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-label={`Photo ${i + 1}`}
                data-index={i}
                onClick={() => setIndex(i)}
                className={cn(
                  "relative aspect-[4/3] w-20 flex-none overflow-hidden rounded-md border-2 transition-colors sm:w-24",
                  selected ? "border-accent-bright" : "border-transparent opacity-80 hover:opacity-100",
                )}
              >
                <Image src={img.url} alt="" fill sizes="96px" className="object-cover" />
              </button>
            );
          })}
        </div>
      ) : null}

      <Lightbox open={open} onOpenChange={setOpen} images={images} index={index} onIndex={setIndex} title={title} />
    </div>
  );
}

function Lightbox({
  open,
  onOpenChange,
  images,
  index,
  onIndex,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: VehicleImage[];
  index: number;
  onIndex: (i: number) => void;
  title: string;
}) {
  const count = images.length;
  const stageRef = useRef<HTMLDivElement>(null);
  const zoom = usePinchZoom(stageRef, { minScale: 1, maxScale: 4 });
  const go = useCallback((delta: number) => onIndex((index + delta + count) % count), [index, count, onIndex]);
  useSwipeGesture(stageRef, { onSwipeLeft: () => zoom.scale === 1 && go(1), onSwipeRight: () => zoom.scale === 1 && go(-1) });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go]);

  const active = images[Math.min(index, count - 1)];

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-[var(--z-modal,70)] bg-navy-950/95 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <DialogPrimitive.Popup
          aria-label={`${title} photos, full screen`}
          className="dark fixed inset-0 z-[var(--z-modal,70)] flex flex-col text-foreground outline-none transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0"
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <p className="truncate text-sm font-medium">
              {title}
              <span className="tabular ml-2 text-body">
                {index + 1} / {count}
              </span>
            </p>
            <DialogPrimitive.Close className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "text-foreground hover:bg-white/10")} aria-label="Close photos">
              <X aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>

          <div ref={stageRef} className="relative min-h-0 flex-1 touch-none select-none">
            <Image
              src={active.url}
              alt={active.altText ?? `${title} — photo ${index + 1} of ${count}`}
              fill
              sizes="100vw"
              className="object-contain transition-transform duration-75"
              style={{ transform: `scale(${zoom.scale})`, transformOrigin: `${zoom.origin.x}px ${zoom.origin.y}px` }}
              draggable={false}
            />
            {count > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => go(-1)}
                  aria-label="Previous photo"
                  className="absolute left-3 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                >
                  <ChevronLeft className="size-6" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  aria-label="Next photo"
                  className="absolute right-3 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                >
                  <ChevronRight className="size-6" aria-hidden="true" />
                </button>
              </>
            ) : null}
          </div>

          <p className="px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 text-center text-xs text-body sm:hidden">Pinch to zoom · swipe for the next photo</p>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
