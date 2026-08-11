import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, pickName } from "@/lib/i18n";
import { useMoney, useBrand } from "@/lib/settings";
import { useCart } from "@/lib/cart";
import { useSignedUrls } from "@/lib/storage";
import { SiteHeader } from "@/components/site-header";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Krunshy — Order from the menu" },
      {
        name: "description",
        content:
          "Browse the Krunshy menu and place an order as a visitor or on your company account in Arabic or English.",
      },
      { property: "og:title", content: "Krunshy — Order from the menu" },
      {
        property: "og:description",
        content: "Browse the Krunshy menu and order as a visitor or on your company account.",
      },
    ],
  }),
  component: MenuPage,
});

type Category = { id: string; name_ar: string; name_en: string; sort_order: number; is_active: boolean };
type Product = {
  id: string;
  category_id: string | null;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  image_url: string | null;
  price: number;
  is_available: boolean;
  is_archived: boolean;
  sort_order: number;
};

export function useMenu() {
  return useQuery({
    queryKey: ["public-menu"],
    queryFn: async () => {
      const [cats, prods] = await Promise.all([
        supabase.from("categories").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("products").select("*").eq("is_archived", false).order("sort_order"),
      ]);
      if (cats.error) throw cats.error;
      if (prods.error) throw prods.error;
      return {
        categories: (cats.data ?? []) as Category[],
        products: (prods.data ?? []) as Product[],
      };
    },
  });
}

function MenuPage() {
  const { t, lang } = useI18n();
  const { name } = useBrand();
  const money = useMoney();
  const cart = useCart();
  const { data, isLoading, isError, refetch } = useMenu();
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");

  const imagePaths = useMemo(() => data?.products.map((p) => p.image_url) ?? [], [data]);
  const { data: images } = useSignedUrls("menu-images", imagePaths);

  const grouped = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    const filtered = data.products.filter((p) => {
      const matchesQuery =
        !q || p.name_ar.toLowerCase().includes(q) || (p.name_en ?? "").toLowerCase().includes(q);
      const matchesCat = activeCat === "all" || p.category_id === activeCat;
      return matchesQuery && matchesCat;
    });
    return data.categories
      .map((c) => ({ category: c, items: filtered.filter((p) => p.category_id === c.id) }))
      .filter((g) => g.items.length > 0)
      .concat(
        filtered.some((p) => !p.category_id)
          ? [
              {
                category: { id: "none", name_ar: "أخرى", name_en: "Other", sort_order: 999, is_active: true },
                items: filtered.filter((p) => !p.category_id),
              },
            ]
          : [],
      );
  }, [data, query, activeCat]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <section className="border-b border-border bg-gradient-to-b from-accent/60 to-background">
        <div className="mx-auto max-w-6xl px-4 py-10 text-center sm:py-14">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{name}</h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">{t("appTagline")}</p>
          <div className="relative mx-auto mt-6 max-w-md">
            <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("search")}
              className="h-11 ps-9 bg-card"
            />
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-6">
        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : (
          <>
            {(data?.categories.length ?? 0) > 0 && (
              <div className="mb-6 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={activeCat === "all" ? "default" : "outline"}
                  onClick={() => setActiveCat("all")}
                >
                  {t("all")}
                </Button>
                {data?.categories.map((c) => (
                  <Button
                    key={c.id}
                    size="sm"
                    variant={activeCat === c.id ? "default" : "outline"}
                    onClick={() => setActiveCat(c.id)}
                  >
                    {pickName(lang, c.name_ar, c.name_en)}
                  </Button>
                ))}
              </div>
            )}

            {grouped.length === 0 ? (
              <EmptyState title={t("noData")} hint={t("browseMenu")} />
            ) : (
              <div className="space-y-10">
                {grouped.map(({ category, items }) => (
                  <section key={category.id}>
                    <h2 className="mb-3 text-lg font-bold">{pickName(lang, category.name_ar, category.name_en)}</h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {items.map((p) => {
                        const img = p.image_url ? images?.[p.image_url] : undefined;
                        const disabled = !p.is_available;
                        return (
                          <article
                            key={p.id}
                            className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition hover:shadow-md"
                          >
                            <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
                              {img ? (
                                <img
                                  src={img}
                                  alt={pickName(lang, p.name_ar, p.name_en)}
                                  loading="lazy"
                                  className="size-full object-cover transition duration-300 group-hover:scale-105"
                                />
                              ) : (
                                <div className="grid size-full place-items-center text-muted-foreground">
                                  <ShoppingBag className="size-8" />
                                </div>
                              )}
                              {disabled && (
                                <Badge variant="secondary" className="absolute top-2 end-2">
                                  {t("outOfStock")}
                                </Badge>
                              )}
                            </div>
                            <div className="flex flex-1 flex-col gap-1 p-4">
                              <h3 className="font-semibold leading-tight">{pickName(lang, p.name_ar, p.name_en)}</h3>
                              {(p.description_ar || p.description_en) && (
                                <p className="line-clamp-2 text-sm text-muted-foreground">
                                  {pickName(lang, p.description_ar, p.description_en)}
                                </p>
                              )}
                              <div className="mt-auto flex items-center justify-between pt-3">
                                <span className="font-bold text-primary">{money(p.price)}</span>
                                <Button
                                  size="sm"
                                  disabled={disabled}
                                  onClick={() => {
                                    cart.add({
                                      productId: p.id,
                                      nameAr: p.name_ar,
                                      nameEn: p.name_en,
                                      price: Number(p.price),
                                      image: p.image_url,
                                    });
                                    toast.success(t("addToCart"));
                                  }}
                                  className="gap-1"
                                >
                                  <Plus className="size-4" />
                                  {t("addToCart")}
                                </Button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {cart.count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 p-3 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-1">
            <div className="text-sm">
              <span className="font-semibold">{cart.count}</span>{" "}
              <span className="text-muted-foreground">{t("items")}</span>
              <span className="mx-2 text-muted-foreground">·</span>
              <span className="font-bold">{money(cart.total)}</span>
            </div>
            <Button asChild className="ms-auto">
              <a href="/cart">{t("checkout")}</a>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
