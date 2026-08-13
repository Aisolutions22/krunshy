import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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

function iconFor(id: string, index: number): LucideIcon {
  return ICONS[index % ICONS.length] ?? Utensils;
}

function MenuPage() {
  const { t, lang } = useI18n();
  const { name } = useBrand();
  const { data, isLoading, isError, refetch } = useMenu();
  const [query, setQuery] = useState("");

  const imagePaths = useMemo(() => data?.products.map((p) => p.image_url) ?? [], [data]);
  const { data: images } = useSignedUrls("menu-images", imagePaths);

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  const results = useMemo(() => {
    if (!data || !searching) return [];
    return data.products.filter(
      (p) => p.name_ar.toLowerCase().includes(q) || (p.name_en ?? "").toLowerCase().includes(q),
    );
  }, [data, q, searching]);

  const catName = (id: string | null) => {
    const c = data?.categories.find((x) => x.id === id);
    return c ? pickName(lang, c.name_ar, c.name_en) : undefined;
  };

  const countFor = (id: string) => data?.products.filter((p) => p.category_id === id).length ?? 0;

  return (
    <MenuSurface>
      <SiteHeader />

      <section className="border-b border-krunshy-dark/10 bg-krunshy-dark text-white">
        <div className="mx-auto max-w-6xl px-4 py-10 text-center sm:py-14">
          <h1 className="krunshy-display text-3xl sm:text-4xl">{name}</h1>
          <p className="mt-2 text-sm text-white/70 sm:text-base">{t("appTagline")}</p>
          <div className="relative mx-auto mt-6 max-w-md">
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

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-6">
        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : searching ? (
          results.length === 0 ? (
            <EmptyState title={t("noData")} hint={t("browseMenu")} />
          ) : (
            <>
              <h2 className="krunshy-display mb-3 text-lg">{t("searchResults")}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((p) => (
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
        ) : (data?.categories.length ?? 0) === 0 ? (
          <EmptyState title={t("noData")} hint={t("browseMenu")} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data?.categories.map((c, i) => {
              const Icon = iconFor(c.id, i);
              return (
                <Link
                  key={c.id}
                  to="/category/$categoryId"
                  params={{ categoryId: c.id }}
                  className="group relative flex min-h-36 flex-col justify-end overflow-hidden rounded-2xl bg-krunshy-dark p-5 text-white shadow-sm transition hover:shadow-lg"
                >
                  <Icon className="absolute -top-3 end-4 size-24 text-white/5 transition group-hover:text-white/10" />
                  <span className="absolute top-4 start-4 grid size-12 place-items-center rounded-full border-2 border-krunshy-amber bg-krunshy-amber/15 text-xs font-extrabold text-krunshy-amber">
                    {countFor(c.id)}
                  </span>
                  <h2 className="krunshy-display relative text-xl leading-tight">
                    {lang === "ar" ? c.name_ar : c.name_en || c.name_ar}
                  </h2>
                  <p className="relative text-sm text-white/60">
                    {lang === "ar" ? c.name_en : c.name_ar}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      <CartBar />
    </MenuSurface>
  );
}
