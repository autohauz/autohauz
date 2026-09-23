import Image from "next/image";
import type { BodyType } from "@/lib/domain";
import { cn } from "@/lib/utils";

/**
 * Body-type imagery — replaces the original SVG line-icons with
 * realistic vehicle photography.
 * The images are sourced from `public/brand/body-types/[type].png`.
 */
export function BodyTypeIcon({ type, className, title }: { type: BodyType; className?: string; title?: string }) {
  return (
    <div className={cn("relative flex items-center justify-center h-24 w-full", className)}>
      <Image
        src={`/brand/body-types/${type}.jpg`}
        alt={title || `${type} body type`}
        fill
        className="object-contain mix-blend-multiply contrast-[1.02] transition-transform duration-300 ease-out group-hover:scale-105"
        sizes="(max-width: 768px) 160px, 240px"
      />
    </div>
  );
}
