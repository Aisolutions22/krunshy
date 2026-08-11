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
    staleTime: 30 * 60_000,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrls(clean, 60 * 60);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const item of data ?? []) {
        if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
      }
      return map;
    },
  });
}

export async function uploadImage(bucket: string, file: File) {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}
