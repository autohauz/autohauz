import Image from "next/image";
import { site } from "@/config/site";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  /** `primary` (navy/azure on light surfaces) or `dark` (for dark surfaces). */
  variant?: "primary" | "dark";
  /** Rendered height in px; width follows the artwork's 2.55:1 ratio. */
  height?: number;
  className?: string;
  priority?: boolean;
};

/** Intrinsic size of the generated 480 px logo files (public/brand). */
const LOGO_RATIO = 480 / 189;

/**
 * The AutoHauz logo, sized by height so it never distorts.
 * Assets are produced by `scripts/brand/build-brand-assets.mjs`.
 */
export function BrandLogo({ variant = "primary", height = 40, className, priority = false }: BrandLogoProps) {
  const src = variant === "dark" ? "/brand/logo-dark-480.png" : "/brand/logo-primary-480.png";
  const width = Math.round(height * LOGO_RATIO);
  return (
    <Image
      src={src}
      alt={site.brandName}
      width={width}
      height={height}
      priority={priority}
      fetchPriority={priority ? "high" : "auto"}
      className={cn("shrink-0 select-none", className)}
      style={{ height, width }}
    />
  );
}
