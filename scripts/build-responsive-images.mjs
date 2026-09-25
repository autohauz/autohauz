/**
 * Pre-encodes responsive WebP variants of the site's static photography.
 *
 * The Next.js image optimiser is off (next.config.ts), so without this every
 * visitor downloaded the full-size JPEG — a 593 KB hero on a phone. Variants
 * are generated once, committed, and served through <ResponsiveImage>, which
 * lets the browser pick the smallest adequate file from `srcset`.
 *
 * Widths must match RESPONSIVE_WIDTHS in src/components/responsive-image.tsx.
 *
 * Usage:  node scripts/build-responsive-images.mjs
 */
import sharp from "sharp";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SETS = [
  { dir: "public/images/heroes", widths: [640, 1080, 1600], quality: 70 },
  { dir: "public/brand/body-types", widths: [320, 640], quality: 72 },
];

for (const set of SETS) {
  const dir = path.join(root, set.dir);
  for (const file of await readdir(dir)) {
    if (!/\.jpe?g$/i.test(file)) continue;
    const src = path.join(dir, file);
    const base = file.replace(/\.jpe?g$/i, "");
    const { width: srcWidth } = await sharp(src).metadata();
    for (const w of set.widths) {
      const out = path.join(dir, `${base}-${w}.webp`);
      await sharp(src)
        .resize({ width: Math.min(w, srcWidth ?? w), withoutEnlargement: true })
        .webp({ quality: set.quality, effort: 6 })
        .toFile(out);
      const kb = ((await stat(out)).size / 1024).toFixed(0);
      console.log(`${set.dir}/${base}-${w}.webp  ${kb} KB`);
    }
  }
}
