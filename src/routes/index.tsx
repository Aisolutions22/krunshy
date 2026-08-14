import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Sandwich,
  Coffee,
  Croissant,
  Drumstick,
  Salad,
  Soup,
  IceCream,
  CupSoda,
  Utensils,
  Cookie,
  Beef,
  Apple,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react";
import { useI18n, pickName } from "@/lib/i18n";
import { useBrand } from "@/lib/settings";
import { useMenu } from "@/lib/menu";
import { useSignedUrls } from "@/lib/storage";
import { SiteHeader } from "@/components/site-header";
import { MenuSurface } from "@/lib/menu-theme";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { ProductCard } from "@/components/menu/product-card";
import { CartBar } from "@/components/menu/cart-bar";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Krunshy — Order from the menu" },
      {
        name: "description",
        content:
          "Browse the Krunshy menu by category and order as a visitor or on your company account in Arabic or English.",
      },
      { property: "og:title", content: "Krunshy — Order from the menu" },
      {
        property: "og:description",
        content: "Browse the Krunshy menu by category and order as a visitor or on your company account.",
      },
    ],
  }),
  component: MenuPage,
});

const ICONS: LucideIcon[] = [
  Sandwich,
  Croissant,
  Cookie,
  Utensils,
  Drumstick,
  Soup,
  Salad,
  Beef,
  Apple,
  CupSoda,
  Coffee,
  IceCream,
];

function iconFor(index: number): LucideIcon {
  return ICONS[index % ICONS.length] ?? Utensils;
}

function MenuPage() {
  const { t, lang, dir } = useI18n();
  const { name } = useBrand();
  const { data, isLoading, isError, refetch } = useMenu();
  const [query, setQuery] = useState("");
  // null = show everything; otherwise the selected category id
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const imagePaths = useMemo(
    () => (activeCategory ? data?.products.filter((p) => p.category_id === activeCategory) : data?.products)?.map((p) => p.image_url) ?? [],
    [data, activeCategory],
  );
  const { data: images } = useSignedUrls("menu-images", imagePaths);

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  // Search results (across all products, ignores active category)
  const searchResults = useMemo(() => {
    if (!data || !searching) return [];
    return data.products.filter(
      (p) => p.name_ar.toLowerCase().includes(q) || (p.name_en ?? "").toLowerCase().includes(q),
    );
  }, [data, q, searching]);

  // Items shown under the sticky bar for the selected category
  const categoryItems = useMemo(() => {
    if (!data) return [];
    if (!activeCategory) return data.products;
    return data.products.filter((p) => p.category_id === activeCategory);
  }, [data, activeCategory]);

  const catName = (id: string | null) => {
    if (!id) return undefined;
    const c = data?.categories.find((x) => x.id === id);
    return c ? pickName(lang, c.name_ar, c.name_en) : undefined;
  };

  // Auto-scroll the active chip into view when selection changes
  const activeChipRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (activeChipRef.current) {
      activeChipRef.current.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
    }
  }, [activeCategory]);

  const categories = data?.categories ?? [];

  return (
    <MenuSurface>
      <SiteHeader />

      <section className="border-b border-krunshy-dark/10 bg-krunshy-dark text-white">
        <div className="mx-auto max-w-6xl px-4 py-8 text-center sm:py-10">
          <h1 className="krunshy-display text-3xl sm:text-4xl">{name}</h1>
          <p className="mt-2 text-sm text-white/70 sm:text-base">{t("appTagline")}</p>
          <div className="relative mx-auto mt-5 max-w-md">
            <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("search")}
              className="h-11 bg-card ps-9 text-foreground"
            />
          </div>
        </div>
      </section>

      {/* Sticky horizontal category bar */}
      <div
        dir={dir}
        className="sticky top-16 z-30 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75"
      >
        <div className="mx-auto max-w-6xl px-2">
          <div className="flex items-stretch gap-1.5 overflow-x-auto py-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <CategoryChip
              ref={!activeCategory ? activeChipRef : undefined}
              active={!activeCategory}
              icon={LayoutGrid}
              label={t("all")}
              onClick={() => setActiveCategory(null)}
            />
            {categories.map((c, i) => (
              <CategoryChip
                key={c.id}
                ref={activeCategory === c.id ? activeChipRef : undefined}
                active={activeCategory === c.id}
                icon={iconFor(i)}
                label={pickName(lang, c.name_ar, c.name_en)}
                onClick={() => setActiveCategory(c.id)}
              />
            ))}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-6">
        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : searching ? (
          searchResults.length === 0 ? (
            <EmptyState title={t("noData")} hint={t("browseMenu")} />
          ) : (
            <>
              <h2 className="krunshy-display mb-3 text-lg">{t("searchResults")}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {searchResults.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    image={p.image_url ? images?.[p.image_url] : undefined}
                    categoryLabel={catName(p.category_id)}
                  />
                ))}
              </div>
            </>
          )
        ) : categories.length === 0 ? (
          <EmptyState title={t("noData")} hint={t("browseMenu")} />
        ) : categoryItems.length === 0 ? (
          <EmptyState title={t("noData")} hint={t("browseMenu")} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categoryItems.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                image={p.image_url ? images?.[p.image_url] : undefined}
                categoryLabel={catName(p.category_id)}
              />
            ))}
          </div>
        )}
      </main>

      <CartBar />
    </MenuSurface>
  );
}

import { forwardRef } from "react";

const CategoryChip = forwardRef<
  HTMLButtonElement,
  { active: boolean; icon: LucideIcon; label: string; onClick: () => void }
>(({ active, icon: Icon, label, onClick }, ref) => (
  <button
    ref={ref}
    type="button"
    onClick={onClick}
    className="group flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition"
    style={
      active
        ? { borderColor: "var(--krunshy-amber)", backgroundColor: "color-mix(in srgb, var(--krunshy-amber) 18%, transparent)", color: "var(--krunshy-red)" }
        : { borderColor: "var(--border)", backgroundColor: "transparent", color: "var(--foreground)" }
    }
  >
    <Icon className="size-4 shrink-0" style={active ? { color: "var(--krunshy-amber)" } : { color: "var(--muted-foreground)" }} />
    <span>{label}</span>
    {active && (
      <span
        aria-hidden
        className="absolute -bottom-2 start-3 end-3 h-0.5 rounded-full"
        style={{ backgroundColor: "var(--krunshy-amber)" }}
      />
    )}
  </button>
));

CategoryChip.displayName = "CategoryChip";
