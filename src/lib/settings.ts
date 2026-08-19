import { queryOptions, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "./i18n";

export type RestaurantSettings = {
  id: string;
  name_ar: string;
  name_en: string;
  logo_url: string | null;
  hero_image_url: string | null;
  primary_color: string;
  accent_color: string;
  currency_code: string;
  currency_symbol_ar: string;
  currency_symbol_en: string;
  contact_phone: string | null;
  contact_email: string | null;
  address: string | null;
};

export const settingsQueryKey = ["restaurant_settings"];

async function fetchSettings(): Promise<RestaurantSettings | null> {
  const { data, error } = await supabase
    .from("restaurant_settings")
    .select("*")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as RestaurantSettings | null) ?? null;
}

/** Shared options so the root loader (SSR) and components read the same cache entry. */
export const settingsQueryOptions = queryOptions({
  queryKey: settingsQueryKey,
  queryFn: fetchSettings,
  staleTime: 60_000,
});

export function useSettings() {
  return useQuery(settingsQueryOptions);
}

/**
 * Signed URLs for the two branding assets (logo + hero). Resolved in the root
 * loader as well, so the hero is already in the HTML on first paint.
 */
export function brandAssetsQueryOptions(paths: (string | null | undefined)[]) {
  const clean = Array.from(new Set(paths.filter((p): p is string => Boolean(p)))).sort();
  return queryOptions({
    queryKey: ["brand-assets", clean],
    enabled: clean.length > 0,
    staleTime: 6 * 60 * 60_000,
    gcTime: 12 * 60 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<Record<string, string>> => {
      if (clean.length === 0) return {};
      const { data, error } = await supabase.storage
        .from("brand-assets")
        .createSignedUrls(clean, 12 * 60 * 60);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const item of data ?? []) if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
      return map;
    },
  });
}

/** Resolved logo + hero URLs derived from the single DB source of truth. */
export function useBrandAssets() {
  const { data: settings } = useSettings();
  const { data } = useQuery(brandAssetsQueryOptions([settings?.logo_url, settings?.hero_image_url]));
  return {
    logo: settings?.logo_url ? data?.[settings.logo_url] : undefined,
    hero: settings?.hero_image_url ? data?.[settings.hero_image_url] : undefined,
  };
}

/**
 * Brand colors are already injected server-side (see __root.tsx) so there is no
 * flash on first paint. This keeps the DOM in sync when the admin edits colors
 * live, without ever being the first source of truth.
 */
export function useApplyBranding() {
  const { data } = useSettings();
  useEffect(() => {
    if (!data || typeof document === "undefined") return;
    const root = document.documentElement;
    if (data.primary_color) root.style.setProperty("--primary", data.primary_color);
    if (data.accent_color) root.style.setProperty("--brand-accent", data.accent_color);
  }, [data]);
}

export function useBrand() {
  const { lang } = useI18n();
  const { data } = useSettings();
  const name = data ? (lang === "ar" ? data.name_ar : data.name_en) : "Crunchy";
  const symbol = data ? (lang === "ar" ? data.currency_symbol_ar : data.currency_symbol_en) : "EGP";
  return { name, symbol, settings: data ?? null };
}

export function useMoney() {
  const { lang } = useI18n();
  const { symbol } = useBrand();
  return (value: number | string | null | undefined) => {
    const raw = Number(value ?? 0);
    const n = Number.isFinite(raw) ? raw : 0;
    const isNegative = n < 0;
    const formatted = new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(n));
    return `${isNegative ? "-" : ""}${formatted} ${symbol}`;
  };
}
