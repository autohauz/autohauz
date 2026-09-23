/**
 * AutoHauz brand asset pipeline.
 *
 * Input:  two client-supplied JPEG screenshots of the logo (light canvas and
 *         black canvas) in ./brand-source/. No vector or alpha was supplied.
 * Output: public/brand/* — transparent PNG/WebP logos for light and dark
 *         surfaces, a square mark derived from the wordmark's own "A" glyph
 *         (for favicons/app icons — the full wordmark is unreadable at 32 px),
 *         favicon.ico, apple-touch-icon, PWA icons and an Open Graph image.
 *
 * The logo is never redrawn or distorted: every output is a crop, a
 * background key, a proportional resize or a composition of the source.
 *
 * Usage:  node scripts/brand/build-brand-assets.mjs
 */
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const SRC_LIGHT = path.join(root, "brand-source", "autohauz-logo-light.jpeg");
const SRC_DARK = path.join(root, "brand-source", "autohauz-logo-dark.jpeg");
const OUT = path.join(root, "public", "brand");

/** Brand navy measured from the artwork (see docs/AUTOHAUZ_BRAND_INVENTORY.md §1). */
const NAVY = { r: 11, g: 53, b: 115 };
const NAVY_DEEP = { r: 7, g: 27, b: 61 };
/** Near-black navy for the OG backdrop — the dark logo variant was drawn for black, and its navy parts vanish on mid-navy. */
const NIGHT = { r: 4, g: 10, b: 24 };

/**
 * Keys a flat background out of raw RGB pixels and returns RGBA.
 * `mode: "white"` makes near-white transparent; `"black"` makes near-black
 * transparent. A soft ramp between `solid` and `clear` keeps anti-aliased
 * edges instead of a jagged cut-out.
 */
function keyBackground(data, channels, mode) {
  const out = Buffer.alloc((data.length / channels) * 4);
  const solid = mode === "white" ? 226 : 40; // fully opaque at/below (white) or at/above (black)
  const clear = mode === "white" ? 247 : 10; // fully transparent beyond this
  for (let i = 0, o = 0; i < data.length; i += channels, o += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = mode === "white" ? Math.min(r, g, b) : Math.max(r, g, b);
    let alpha;
    if (mode === "white") alpha = key <= solid ? 255 : key >= clear ? 0 : Math.round(255 * (1 - (key - solid) / (clear - solid)));
    else alpha = key >= solid ? 255 : key <= clear ? 0 : Math.round(255 * ((key - clear) / (solid - clear)));
    // The light screenshot is letterboxed with black bars; the brand navy
    // never drops below max-channel 60, so near-black is safely background too.
    if (mode === "white" && Math.max(r, g, b) < 24) alpha = 0;
    out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = alpha;
  }
  return out;
}

/** Brand ink = visibly blue. Excludes canvas, letterbox bars, JPEG ringing and the white speed-lines. */
function isBlue(r, g, b) {
  return b > r + 25 && b > 60;
}

/** Bounding box of opaque, blue pixels — i.e. the artwork itself. */
function alphaBounds(rgba, width, height, minAlpha = 16) {
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (rgba[i + 3] > minAlpha && isBlue(rgba[i], rgba[i + 1], rgba[i + 2])) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** Loads a source JPEG, keys its background and trims to the artwork. Returns a sharp instance (RGBA). */
async function extractLogo(file, mode) {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const rgba = keyBackground(data, info.channels, mode);
  const box = alphaBounds(rgba, info.width, info.height);
  const pad = 12;
  const left = Math.max(0, box.left - pad), top = Math.max(0, box.top - pad);
  const width = Math.min(info.width - left, box.width + pad * 2);
  const height = Math.min(info.height - top, box.height + pad * 2);
  return sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).extract({ left, top, width, height });
}

/**
 * Finds the wordmark's first glyph ("A").
 *
 * The letters overlap the ellipse fill, so component analysis lumps the whole
 * wordmark together, and because the type is italic a plain column projection
 * cannot separate "A" from "U" either (their bounding boxes overlap). So the
 * projection is taken along the italic axis: each ink pixel is shifted by
 * `slant × (y − bandTop)` before counting columns, which makes the gap between
 * letters vertical. The best slant is the one that opens the widest gap. The
 * glyph is then cut out along that slanted boundary — pixels are masked, never
 * moved, so the letter keeps its exact original shape.
 */
async function extractFirstGlyph(logo) {
  const { data, info } = await logo.clone().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  // Left of the ellipse (which begins ~19 % in) only "A" and "U" exist.
  const strip = Math.floor(width * 0.17);
  const ink = (x, y) => {
    const i = (y * width + x) * 4;
    return data[i + 3] > 128 && isBlue(data[i], data[i + 1], data[i + 2]);
  };
  // Rows with blue ink in the strip form runs separated by empty rows: the
  // letters are the tallest run; the navy speed-line below them is a thin
  // separate run and everything outside the tallest run is ignored.
  const hasInk = new Uint8Array(height);
  for (let y = 0; y < height; y++) for (let x = 0; x < strip; x++) if (ink(x, y)) { hasInk[y] = 1; break; }
  let bandTop = -1, bandBottom = -1, runStart = -1;
  for (let y = 0; y <= height; y++) {
    const on = y < height && hasInk[y];
    if (on && runStart < 0) runStart = y;
    if (!on && runStart >= 0) {
      if (bandTop < 0 || y - runStart > bandBottom - bandTop + 1) { bandTop = runStart; bandBottom = y - 1; }
      runStart = -1;
    }
  }
  if (bandTop < 0) throw new Error("Could not locate the wordmark band");
  const lineLike = new Uint8Array(height);
  for (let y = 0; y < height; y++) if (y < bandTop || y > bandBottom) lineLike[y] = 1;

  let best = null; // { slant, boundary, start }
  for (let slant = 0; slant <= 0.6; slant += 0.02) {
    const col = new Map();
    for (let y = bandTop; y <= bandBottom; y++) {
      if (lineLike[y]) continue;
      for (let x = 0; x < strip; x++) {
        if (!ink(x, y)) continue;
        const xs = Math.round(x - slant * (y - bandTop));
        col.set(xs, (col.get(xs) ?? 0) + 1);
      }
    }
    const xsMin = Math.min(...col.keys()), xsMax = Math.max(...col.keys());
    // Walk the projection: the "A" is the first ink run at least a third of the
    // strip wide (skipping bevel flecks); the gap after it is what we measure.
    const minRun = Math.floor(strip * 0.3);
    let start = -1, end = -1, gapWidth = 0, gapStart = -1;
    for (let xs = xsMin; xs <= xsMax; xs++) {
      const has = (col.get(xs) ?? 0) > 0;
      if (has) {
        if (start < 0) start = xs;
        if (gapStart >= 0) {
          if (end - start + 1 >= minRun) { gapWidth = xs - gapStart; break; }
          gapStart = -1; // fleck-sized run: keep absorbing
        }
        end = xs;
      } else if (start >= 0 && gapStart < 0) {
        gapStart = xs;
      }
    }
    if (gapWidth > 0 && (!best || gapWidth > best.gapWidth)) best = { slant, start, boundary: end + 1, gapWidth };
  }
  if (!best) throw new Error("Could not separate the first glyph from the wordmark");
  console.log(`  italic slant ${best.slant.toFixed(2)}, inter-letter gap ${best.gapWidth}px`);

  // Mask everything to the right of the slanted boundary, then crop to the A.
  const belongs = (x, y) => x - best.slant * (y - bandTop) < best.boundary;
  const out = Buffer.from(data);
  let minX = width, maxX = -1, minY = height, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const inBand = y >= bandTop && y <= bandBottom && !lineLike[y];
      if (!inBand || !belongs(x, y) || x >= strip) { out[i + 3] = 0; continue; }
      if (out[i + 3] > 16 && isBlue(out[i], out[i + 1], out[i + 2])) {
        if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  const pad = 3;
  const left = Math.max(0, minX - pad), top = Math.max(0, minY - pad);
  return sharp(out, { raw: { width, height, channels: 4 } }).extract({
    left, top, width: Math.min(width - left, maxX - minX + 1 + pad * 2), height: Math.min(height - top, maxY - minY + 1 + pad * 2),
  });
}

/** Square tile: navy background, glyph centred with padding. */
async function tile(glyphBuffer, size, bg = NAVY) {
  const pad = Math.round(size * 0.18);
  const inner = size - pad * 2;
  const glyph = await sharp(glyphBuffer).resize({ width: inner, height: inner, fit: "inside" }).png().toBuffer();
  const meta = await sharp(glyph).metadata();
  return sharp({ create: { width: size, height: size, channels: 4, background: { ...bg, alpha: 1 } } })
    .composite([{ input: glyph, left: Math.round((size - meta.width) / 2), top: Math.round((size - meta.height) / 2) }])
    .png();
}

/** Minimal ICO container wrapping PNG images (supported by all modern browsers). */
function buildIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  let offset = 6 + 16 * pngs.length;
  const bodies = [];
  for (const { size, buffer } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2); e.writeUInt8(0, 3); e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
    e.writeUInt32LE(buffer.length, 8); e.writeUInt32LE(offset, 12);
    entries.push(e); bodies.push(buffer); offset += buffer.length;
  }
  return Buffer.concat([header, ...entries, ...bodies]);
}

async function main() {
  await mkdir(OUT, { recursive: true });

  // 1. Transparent logos
  const light = await extractLogo(SRC_LIGHT, "white");
  const dark = await extractLogo(SRC_DARK, "black");
  const lightPng = await light.clone().png({ compressionLevel: 9 }).toBuffer();
  const darkPng = await dark.clone().png({ compressionLevel: 9 }).toBuffer();
  const lightMeta = await sharp(lightPng).metadata();
  const darkMeta = await sharp(darkPng).metadata();

  for (const [name, buf, meta] of [["logo-primary", lightPng, lightMeta], ["logo-dark", darkPng, darkMeta]]) {
    // Master at source resolution (~1000 px wide) plus a 480 px web size.
    await sharp(buf).png({ compressionLevel: 9 }).toFile(path.join(OUT, `${name}.png`));
    await sharp(buf).webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(OUT, `${name}.webp`));
    await sharp(buf).resize({ width: 480 }).png({ compressionLevel: 9 }).toFile(path.join(OUT, `${name}-480.png`));
    await sharp(buf).resize({ width: 480 }).webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(OUT, `${name}-480.webp`));
    console.log(`${name}: ${meta.width}x${meta.height}`);
  }

  // 2. Mark from the "A" glyph (dark variant: light bevels read well on navy)
  const glyph = await (await extractFirstGlyph(sharp(darkPng))).png().toBuffer();
  const glyphMeta = await sharp(glyph).metadata();
  console.log(`mark glyph: ${glyphMeta.width}x${glyphMeta.height}`);
  await sharp(glyph).toFile(path.join(OUT, "mark-glyph.png"));
  await (await tile(glyph, 512)).toFile(path.join(OUT, "mark.png"));

  // 3. Favicons / app icons
  const sizes = { "favicon-16.png": 16, "favicon-32.png": 32, "apple-touch-icon.png": 180, "icon-192.png": 192, "icon-512.png": 512 };
  for (const [file, size] of Object.entries(sizes)) await (await tile(glyph, size)).toFile(path.join(OUT, file));
  // Maskable icons need the glyph inside the 80 % safe zone.
  for (const size of [192, 512]) {
    const pad = Math.round(size * 0.24);
    const inner = size - pad * 2;
    const g = await sharp(glyph).resize({ width: inner, height: inner, fit: "inside" }).png().toBuffer();
    const gm = await sharp(g).metadata();
    await sharp({ create: { width: size, height: size, channels: 4, background: { ...NAVY, alpha: 1 } } })
      .composite([{ input: g, left: Math.round((size - gm.width) / 2), top: Math.round((size - gm.height) / 2) }])
      .png().toFile(path.join(OUT, `icon-maskable-${size}.png`));
  }
  const ico = buildIco([
    { size: 16, buffer: await (await tile(glyph, 16)).toBuffer() },
    { size: 32, buffer: await (await tile(glyph, 32)).toBuffer() },
    { size: 48, buffer: await (await tile(glyph, 48)).toBuffer() },
  ]);
  await writeFile(path.join(OUT, "favicon.ico"), ico);

  // 4. Open Graph image 1200×630: dark logo on a navy gradient
  const W = 1200, H = 630;
  const gradient = Buffer.from(
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="rgb(${NAVY_DEEP.r},${NAVY_DEEP.g},${NAVY_DEEP.b})"/>
        <stop offset="1" stop-color="rgb(${NIGHT.r},${NIGHT.g},${NIGHT.b})"/>
      </linearGradient></defs>
      <rect width="${W}" height="${H}" fill="url(#g)"/>
    </svg>`,
  );
  const ogLogo = await sharp(darkPng).resize({ width: 820 }).png().toBuffer();
  const ogMeta = await sharp(ogLogo).metadata();
  await sharp(gradient)
    .composite([{ input: ogLogo, left: Math.round((W - ogMeta.width) / 2), top: Math.round((H - ogMeta.height) / 2) }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(path.join(OUT, "og-image.jpg"));

  console.log("brand assets written to", path.relative(root, OUT));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
