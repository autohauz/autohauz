"use client";

import { useState } from "react";
import { UploadCloud, X, Loader2, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Compress standard matches image-upload.tsx
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
      let { width, height } = img;
      const ratio = width / height;

      if (width > MAX_W) { width = MAX_W; height = Math.round(MAX_W / ratio); }
      if (height > MAX_H) { height = MAX_H; width = Math.round(MAX_H * ratio); }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas context unavailable")); return; }

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob1) => {
          if (!blob1) { reject(new Error("Canvas toBlob failed")); return; }
          if (blob1.size <= HARD_CAP_BYTES) {
            resolve({ blob: blob1, originalKb, compressedKb: Math.round(blob1.size / 1024) });
            return;
          }
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

export function BlogImageUpload({ 
  initialUrl,
  name = "featuredImageUrl",
  label = "Featured Image"
}: { 
  initialUrl?: string | null;
  name?: string;
  label?: string;
}) {
  const [url, setUrl] = useState<string | null>(initialUrl || null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;

    setUploading(true);
    setError(null);

    try {
      const { blob } = await compressToWebP(file);
      const rand = Math.random().toString(36).substring(2, 15);
      const filePath = `blog/\${rand}_\${Date.now()}.webp`;

      const { data, error: uploadError } = await supabase.storage
        .from("media")
        .upload(filePath, blob, { contentType: "image/webp", upsert: false });

      if (uploadError) throw new Error(uploadError.message);

      const { data: publicUrlData } = supabase.storage
        .from("media")
        .getPublicUrl(data.path);

      setUrl(publicUrlData.publicUrl);
    } catch (err: any) {
      setError(err.message || "Failed to upload image");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-4">
      {/* Hidden input for form submission */}
      <input type="hidden" name={name} value={url || ""} />

      <label className="block text-sm font-medium text-foreground mb-1">{label}</label>
      
      {url ? (
        <div className="relative group aspect-video rounded-xl border border-border overflow-hidden bg-muted max-w-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={label} className="object-cover w-full h-full" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
            <button
              type="button"
              onClick={() => setUrl(null)}
              className="self-end p-2 bg-danger/90 hover:bg-danger text-white rounded-full transition-colors backdrop-blur-sm shadow-sm"
              title="Remove image"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center w-full max-w-lg">
          <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl cursor-pointer hover:bg-muted/50 border-border bg-card transition-colors">
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
                    Auto-converted to WebP
                  </p>
                </>
              )}
            </div>
            <input
              type="file"
              className="hidden"
              accept="image/*"
              onChange={handleFileChange}
              disabled={uploading}
            />
          </label>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
