import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useI18n, pickName } from "@/lib/i18n";
import { useBrand, useBrandAssets } from "@/lib/settings";
import { useMenu } from "@/lib/menu";
import { useSignedUrls } from "@/lib/storage";
import { searchTokens, matchesTokens } from "@/lib/search";
import { useMenuSearch } from "@/lib/menu-search";

import { SiteHeader } from "@/components/site-header";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { ProductCard } from "@/components/menu/product-card";
import { CartBar } from "@/components/menu/cart-bar";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Crunchy — Online Food Ordering & Menu" },
      {
        name: "description",
        content:
          "Browse the full Crunchy menu and order online as a guest or on a company account — fast food ordering in Arabic and English.",
      },
      { property: "og:title", content: "Crunchy — Online Food Ordering & Menu" },
      {
        property: "og:description",
        content:
          "Browse the full Crunchy menu and order online as a guest or on a company account — fast food ordering in Arabic and English.",
      },
      { property: "og:url", content: "https://crunchy-food.lovable.app/" },
      { property: "og:image", content: "https://crunchy-food.lovable.app/og-image.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "Crunchy — Online Food Ordering & Menu" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://crunchy-food.lovable.app/og-image.jpg" },
    ],
    links: [{ rel: "canonical", href: "https://crunchy-food.lovable.app/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Restaurant",
          name: "Crunchy",
          alternateName: "Crunchy",
          description:
            "Krunshy restaurant ordering and account management — browse the menu by category and order as a visitor or on a company account.",
          servesCuisine: "Fast food",
          url: "https://crunchy-food.lovable.app/",
          telephone: "01005382216",
          hasMenu: "https://crunchy-food.lovable.app/",
          acceptsReservations: false,
        }),
      },
    ],
  }),
  component: MenuPage,
});

const ALL = "__all__";

function MenuPage() {
  const { t, lang, dir } = useI18n();
  const { name } = useBrand();
  const { data, isLoading, isError, refetch } = useMenu();
  const { query } = useMenuSearch();
  // "" = nothing selected yet (no products shown), ALL = every product
  const [selected, setSelected] = useState<string>("");

  const tokens = searchTokens(query);
  const searching = tokens.length > 0;

  const visible = useMemo(() => {
    if (!data) return [];
    if (searching) {
      const catById = new Map(data.categories.map((c) => [c.id, c]));
      return data.products.filter((p) => {
        const c = p.category_id ? catById.get(p.category_id) : undefined;
        return matchesTokens(tokens, p.name_ar, p.name_en, c?.name_ar, c?.name_en);
      });
    }
    if (!selected) return [];
    if (selected === ALL) return data.products;
    return data.products.filter((p) => p.category_id === selected);
  }, [data, tokens, searching, selected]);

  const { data: images } = useSignedUrls("menu-images", visible.map((p) => p.image_url));
  const { hero } = useBrandAssets();

  const catName = (id: string | null) => {
    if (!id) return undefined;
    const c = data?.categories.find((x) => x.id === id);
    return c ? pickName(lang, c.name_ar, c.name_en) : undefined;
  };

  const categories = data?.categories ?? [];

  return (
    <div className="min-h-screen">
      <SiteHeader />

      {/* Hero — the uploaded image is the centerpiece: never cropped, never stretched. */}
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-b from-brand-softer via-background to-background" aria-hidden="true" />
        <div className="relative mx-auto flex max-w-6xl flex-col items-center px-4 pb-10 pt-6 text-center sm:pb-14 sm:pt-10">
          {hero ? (
            <img
              src={hero}
              alt={name}
              className="mx-auto max-h-[46vh] w-auto max-w-full object-contain sm:max-h-[26rem]"
              loading="eager"
              fetchPriority="high"
            />
          ) : (
            <div className="h-40 w-full max-w-2xl rounded-3xl bg-linear-to-br from-primary/80 via-primary/40 to-brand-accent/60 sm:h-56" />
          )}
          <h1 className="krunshy-display mt-6 text-3xl leading-tight text-foreground sm:text-5xl">{"\n"}</h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            {"\n"}
          </p>
          <a
            href="#menu"
            className="mt-6 inline-flex min-h-11 items-center rounded-full bg-primary px-6 text-sm font-extrabold text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {t("exploreMenu")}
          </a>
        </div>
      </section>

      <main id="menu" dir={dir} className="mx-auto w-full max-w-6xl overflow-x-hidden px-4 pb-28 pt-8">
        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : (
          <>
            {categories.length > 0 && (
              <nav aria-label={t("categories")} className="mb-6">
                <ul className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
                  <li className="shrink-0 snap-start">
                    <Chip active={selected === ALL} label={t("all")} onClick={() => setSelected(ALL)} />
                  </li>
                  {categories.map((c) => (
                    <li key={c.id} className="shrink-0 snap-start">
                      <Chip
                        active={selected === c.id}
                        label={pickName(lang, c.name_ar, c.name_en)}
                        onClick={() => setSelected(c.id)}
                      />
                    </li>
                  ))}
                </ul>
              </nav>
            )}

            {!searching && !selected ? (
              <div className="rounded-3xl border border-brand-border/50 bg-brand-softer px-6 py-14 text-center">
                <p className="krunshy-display text-lg">
                  {lang === "ar" ? "اختر قسمًا لعرض الأصناف" : "Pick a category to see items"}
                </p>
              </div>
            ) : visible.length === 0 ? (
              <EmptyState title={t("noData")} hint={t("browseMenu")} />
            ) : (
              <>
                <h2 className="mb-3 text-lg font-bold">
                  {searching
                    ? lang === "ar"
                      ? "نتائج البحث"
                      : "Search results"
                    : selected === ALL
                      ? lang === "ar"
                        ? "كل الأصناف"
                        : "All items"
                      : (catName(selected) ?? (lang === "ar" ? "الأصناف" : "Items"))}
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
                  {visible.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      image={p.image_url ? images?.[p.image_url] : undefined}
                      categoryLabel={catName(p.category_id)}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>

      <CartBar />
    </div>
  );
}

function Chip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "min-h-11 whitespace-nowrap rounded-full bg-primary px-4 py-2 text-sm font-extrabold text-primary-foreground shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          : "min-h-11 whitespace-nowrap rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition hover:border-brand-border hover:bg-brand-softer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      }
    >
      {label}
    </button>
  );
}
