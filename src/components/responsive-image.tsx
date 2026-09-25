import { cn } from "@/lib/utils";

/**
 * Widths pre-encoded by scripts/build-responsive-images.mjs, per folder.
 * Keep in sync with that script.
 */
const RESPONSIVE_WIDTHS: Record<string, number[]> = {
  "/images/heroes/": [640, 1080, 1600],
  "/brand/body-types/": [320, 640],
};

function variants(src: string) {
  const dir = Object.keys(RESPONSIVE_WIDTHS).find((d) => src.startsWith(d));
  if (!dir) throw new Error(`No responsive variants are generated for ${src}`);
  const base = src.replace(/\.jpe?g$/i, "");
  const widths = RESPONSIVE_WIDTHS[dir];
  return {
    srcSet: widths.map((w) => `${base}-${w}.webp ${w}w`).join(", "),
    fallback: `${base}-${widths[widths.length - 1]}.webp`,
  };
}

/**
 * Static site photography served as right-sized WebP (the Next.js optimiser
 * is disabled, see next.config.ts). `fill` covers the positioned parent like
 * next/image's `fill`; `priority` marks the LCP image (eager + high fetch
 * priority) — use it on at most one image per page.
 */
export function ResponsiveImage({
  src,
  alt,
  sizes,
  className,
  fill = false,
  priority = false,
  width,
  height,
}: {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  fill?: boolean;
  priority?: boolean;
  width?: number;
  height?: number;
}) {
  const { srcSet, fallback } = variants(src);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- pre-optimised variants; the Next optimiser is off
    <img
      src={fallback}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding={priority ? "sync" : "async"}
      className={cn(fill && "absolute inset-0 h-full w-full", className)}
    />
  );
}
