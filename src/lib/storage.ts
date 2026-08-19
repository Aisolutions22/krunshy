import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Images live in private buckets, so we resolve short-lived signed URLs.
 * Values are cached by path so a menu grid only signs each image once.
 */
export function useSignedUrls(bucket: string, paths: (string | null | undefined)[]) {
  const clean = Array.from(new Set(paths.filter((p): p is string => Boolean(p)))).sort();
  return useQuery({
    queryKey: ["signed-urls", bucket, clean],
    enabled: clean.length > 0,
    staleTime: 6 * 60 * 60_000,
    gcTime: 12 * 60 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrls(clean, 12 * 60 * 60);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const item of data ?? []) {
        if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
      }
      return map;
    },
  });
}

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const MAX_EDGE = 800;

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/** Resize (longest side <= 800px) and re-encode to WebP (fallback JPEG). */
export async function compressImage(file: File, maxEdge: number = MAX_EDGE): Promise<Blob> {
  if (file.type === "image/svg+xml" || typeof document === "undefined") return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const encode = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.8));

  let blob = await encode("image/webp");
  if (!blob || blob.type !== "image/webp") blob = await encode("image/jpeg");
  if (!blob) return file;
  return blob.size < file.size ? blob : file;
}

export type UploadResult = { path: string; originalSize: number; uploadedSize: number };

export async function uploadImageDetailed(
  bucket: string,
  file: File,
  maxEdge: number = MAX_EDGE,
): Promise<UploadResult> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `الملف كبير جدًا (${formatBytes(file.size)}). الحد الأقصى 20MB / File too large, max 20MB.`,
    );
  }
  const blob = await compressImage(file, maxEdge);
  const ext =
    blob.type === "image/webp" ? "webp" : blob.type === "image/jpeg" ? "jpg" : (file.name.split(".").pop() ?? "jpg");
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, blob, { upsert: false, contentType: blob.type, cacheControl: "31536000" });
  if (error) throw error;
  return { path, originalSize: file.size, uploadedSize: blob.size };
}

export async function uploadImage(bucket: string, file: File) {
  const { path } = await uploadImageDetailed(bucket, file);
  return path;
}
