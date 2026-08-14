import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "./i18n";

export type RestaurantSettings = {
  id: string;
  name_ar: string;
  name_en: string;
  logo_url: string | null;
  favicon_url: string | null;
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

export function useSettings() {
  return useQuery({
    queryKey: settingsQueryKey,
    queryFn: async (): Promise<RestaurantSettings | null> => {
      const { data, error } = await supabase
        .from("restaurant_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as RestaurantSettings | null) ?? null;
    },
    staleTime: 60_000,
  });
}

/** Applies brand colors from settings onto CSS variables. */
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
  const name = data ? (lang === "ar" ? data.name_ar : data.name_en) : "Krunshy";
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

