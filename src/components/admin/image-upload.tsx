"use client";

import { useState } from "react";
import { UploadCloud, X, Loader2, Image as ImageIcon, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type UploadedImage = {
  path: string;
  url: string;
  isCover: boolean;
};

// ─── Industry-standard compression targets ────────────────────────────────────
// Matches Carsales / Drive.com.au pipeline:
//   • Max 1920 px wide (landscape), 1080 px tall (portrait clamp)
//   • WebP q=0.82 — good detail, ~70-80 % size reduction vs raw JPEG
//   • Hard cap: if still >250 KB after first pass, re-encode at q=0.72
// ─────────────────────────────────────────────────────────────────────────────
const MAX_W = 1920;
const MAX_H = 1080;
const QUALITY_HIGH = 0.82;
const QUALITY_FALLBACK = 0.72;
const HARD_CAP_BYTES = 250 * 1024; // 250 KB

async function compressToWebP(file: File): Promise<{ blob: Blob; originalKb: number; compressedKb: number }> {
  const originalKb = Math.round(file.size / 1024);

  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      // Calculate target dimensions preserving aspect ratio
      let { width, height } = img;
      const ratio = width / height;

      if (width > MAX_W) { width = MAX_W; height = Math.round(MAX_W / ratio); }
      if (height > MAX_H) { height = MAX_H; width = Math.round(MAX_H * ratio); }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas context unavailable")); return; }

      // White background prevents transparency artifacts on non-PNG sources
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      // First pass
      canvas.toBlob(
        (blob1) => {
          if (!blob1) { reject(new Error("Canvas toBlob failed")); return; }

          if (blob1.size <= HARD_CAP_BYTES) {
            resolve({ blob: blob1, originalKb, compressedKb: Math.round(blob1.size / 1024) });
            return;
          }

          // Second pass at lower quality if still over cap
          canvas.toBlob(
            (blob2) => {
              const final = blob2 ?? blob1;
              resolve({ blob: final, originalKb, compressedKb: Math.round(final.size / 1024) });
            },
            "image/webp",
            QUALITY_FALLBACK,
          );
        },
        "image/webp",
        QUALITY_HIGH,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Failed to load image: ${file.name}`));
    };

    img.src = objectUrl;
  });
}

function generateStorageKey(): string {
  // Matches the existing naming pattern in the media/vehicles/ folder
  const rand = Math.random().toString(36).substring(2, 15);
  return `vehicles/${rand}_${Date.now()}.webp`;
}

type UploadStats = { originalKb: number; compressedKb: number };

export function ImageUpload({ initialImages = [] }: { initialImages?: UploadedImage[] }) {
  const [images, setImages] = useState<UploadedImage[]>(initialImages);

  // Re-sync when the parent supplies a different set (e.g. the Next.js router
  // cache reusing this component for another vehicle). Adjusting state during
  // render — rather than in an effect — avoids a flash of the stale list and a
  // cascading re-render (React docs: "Adjusting some state when a prop changes").
  const initialImagesStr = JSON.stringify(initialImages);
  const [syncedFrom, setSyncedFrom] = useState(initialImagesStr);
  if (syncedFrom !== initialImagesStr) {
    setSyncedFrom(initialImagesStr);
    setImages(initialImages);
  }
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<UploadStats | null>(null);
  const supabase = createClient();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setUploading(true);
    setError(null);
    setStats(null);

    const newImages: UploadedImage[] = [];
    let totalOriginalKb = 0;
    let totalCompressedKb = 0;

    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;

      let blob: Blob;
      let originalKb: number;
      let compressedKb: number;

      try {
        ({ blob, originalKb, compressedKb } = await compressToWebP(file));
        totalOriginalKb += originalKb;
        totalCompressedKb += compressedKb;
      } catch {
        setError(`Failed to compress ${file.name}. Uploading original.`);
        blob = file;
        originalKb = Math.round(file.size / 1024);
        compressedKb = originalKb;
        totalOriginalKb += originalKb;
        totalCompressedKb += compressedKb;
      }

      const filePath = generateStorageKey();

      const { data, error: uploadError } = await supabase.storage
        .from("media")
        .upload(filePath, blob, { contentType: "image/webp", upsert: false });

      if (uploadError) {
        setError(`Failed to upload ${file.name}: ${uploadError.message}`);
        continue;
      }

      const { data: publicUrlData } = supabase.storage
        .from("media")
        .getPublicUrl(data.path);

      newImages.push({ path: data.path, url: publicUrlData.publicUrl, isCover: false });
    }

    if (totalOriginalKb > 0) {
      setStats({ originalKb: totalOriginalKb, compressedKb: totalCompressedKb });
    }

    setImages((prev) => {
      const updated = [...prev, ...newImages];
      if (updated.length > 0 && !updated.some((img) => img.isCover)) {
        updated[0] = { ...updated[0], isCover: true };
      }
      return updated;
    });

    setUploading(false);
    e.target.value = "";
  };

  const removeImage = (index: number) => {
    const imgToRemove = images[index];
    const newImages = images.filter((_, i) => i !== index);
    if (imgToRemove.isCover && newImages.length > 0) {
      newImages[0] = { ...newImages[0], isCover: true };
    }
    setImages(newImages);
  };

  const setCover = (index: number) => {
    setImages(images.map((img, i) => ({ ...img, isCover: i === index })));
  };

  const savingsPercent =
    stats && stats.originalKb > 0
      ? Math.round(((stats.originalKb - stats.compressedKb) / stats.originalKb) * 100)
      : 0;

  return (
    <div className="space-y-4">
      {/* Hidden input to pass to Server Action */}
      <input type="hidden" name="imageKeys" value={JSON.stringify(images)} />

      <div className="flex items-center justify-center w-full">
        <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-xl cursor-pointer hover:bg-muted/50 border-border bg-card transition-colors">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            {uploading ? (
              <>
                <Loader2 className="size-8 text-primary animate-spin mb-2" />
                <p className="text-sm text-muted-foreground">Compressing &amp; uploading…</p>
              </>
            ) : (
              <>
                <UploadCloud className="size-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Any format → auto-converted to WebP (max 10 MB)
                </p>
              </>
            )}
          </div>
          <input
            type="file"
            className="hidden"
            multiple
            accept="image/*"
            onChange={handleFileChange}
            disabled={uploading}
          />
        </label>
      </div>

      {/* Compression stats toast */}
      {stats && !uploading && (
        <div className="flex items-center gap-2.5 rounded-lg bg-success/8 border border-success/20 px-3.5 py-2.5 text-sm">
          <CheckCircle2 className="size-4 text-success shrink-0" />
          <span className="text-success font-medium">
            Compressed {stats.originalKb} KB → {stats.compressedKb} KB
            <span className="ml-1.5 font-bold">({savingsPercent}% smaller)</span>
          </span>
          <span className="ml-auto text-xs text-muted-foreground">WebP • industry standard</span>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
          {images.map((img, i) => (
            <div
              key={img.path}
              className="relative group aspect-square rounded-xl border border-border overflow-hidden bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="Upload preview" className="object-cover w-full h-full" />

              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="self-end p-1.5 bg-danger/80 hover:bg-danger text-white rounded-full transition-colors"
                  title="Remove image"
                >
                  <X className="size-4" />
                </button>

                {!img.isCover && (
                  <button
                    type="button"
                    onClick={() => setCover(i)}
                    className="w-full py-1.5 text-xs font-semibold bg-black/60 hover:bg-black text-white rounded transition-colors"
                  >
                    Set as Cover
                  </button>
                )}
              </div>

              {img.isCover && (
                <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded shadow-sm flex items-center gap-1">
                  <ImageIcon className="size-3" /> COVER
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
