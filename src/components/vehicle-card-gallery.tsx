"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { VEHICLE_PLACEHOLDER } from "@/lib/media";

interface VehicleCardGalleryProps {
  coverImage: string | null;
  alt: string;
  images?: string[];
  priority?: boolean;
  sold?: boolean;
}

export function VehicleCardGallery({ coverImage, alt, images = [], priority, sold }: VehicleCardGalleryProps) {
  const allImages = images.length > 0 ? images : (coverImage ? [coverImage] : [VEHICLE_PLACEHOLDER]);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const hasMultiple = allImages.length > 1;

  const handlePrevious = (e: React.MouseEvent) => {
    e.preventDefault(); // prevent triggering the link wrapping the card
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? allImages.length - 1 : prev - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === allImages.length - 1 ? 0 : prev + 1));
  };

  const currentImage = allImages[currentIndex];

  return (
    <div className="group/gallery relative aspect-[4/3] w-full overflow-hidden bg-muted">
      <Image
        src={currentImage}
        alt={alt}
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1440px) 33vw, 25vw"
        preload={priority && currentIndex === 0}
        fetchPriority={priority && currentIndex === 0 ? "high" : undefined}
        className={cn(
          "object-cover transition-[filter] duration-150 group-hover:brightness-[1.03]",
          sold && "grayscale-[40%]"
        )}
      />

      {/* Navigation Arrows (visible on hover) */}
      {hasMultiple && (
        <>
          <button
            type="button"
            onClick={handlePrevious}
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 flex size-8 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover/gallery:opacity-100 focus-visible:opacity-100"
            aria-label="Previous image"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 flex size-8 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover/gallery:opacity-100 focus-visible:opacity-100"
            aria-label="Next image"
          >
            <ChevronRight className="size-5" aria-hidden="true" />
          </button>

          {/* Camera Icon Overlay */}
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
            <Camera className="size-3.5" />
            <span>{currentIndex + 1}/{allImages.length}</span>
          </div>

          {/* Pagination Dots */}
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {allImages.slice(0, 5).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === Math.min(currentIndex, 4) ? "w-4 bg-white" : "w-1.5 bg-white/50"
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
