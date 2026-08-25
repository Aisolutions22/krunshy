import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MenuProduct } from "@/components/menu/product-card";

export type MenuCategory = {
  id: string;
  name_ar: string;
  name_en: string;
  sort_order: number;
  is_active: boolean;
};

export type MenuProductRow = MenuProduct & { is_archived: boolean; sort_order: number };

export function useMenu() {
  return useQuery({
    queryKey: ["public-menu"],
    queryFn: async () => {
      const [cats, prods] = await Promise.all([
        supabase
          .from("categories")
          .select("*")
          .eq("is_active", true)
          .order("sort_order")
          .order("created_at"),
        supabase
          .from("products")
          .select("*")
          .eq("is_archived", false)
          .order("sort_order")
          .order("created_at"),
      ]);
      if (cats.error) throw cats.error;
      if (prods.error) throw prods.error;
      return {
        categories: (cats.data ?? []) as MenuCategory[],
        products: (prods.data ?? []) as MenuProductRow[],
      };
    },
  });
}
