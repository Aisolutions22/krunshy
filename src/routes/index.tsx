import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useI18n, pickName } from "@/lib/i18n";
import { useBrand } from "@/lib/settings";
import { useMenu } from "@/lib/menu";
import { useSignedUrls } from "@/lib/storage";
import { searchTokens, matchesTokens } from "@/lib/search";
import { useMenuSearch } from "@/lib/menu-search";

import { SiteHeader } from "@/components/site-header";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { ProductCard } from "@/components/menu/product-card";
import { CartBar } from "@/components/menu/cart-bar";
import { OrderingClosedScreen, useOrderingClosed } from "@/components/ordering-closed";

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
const BATCH = 24;

function MenuPage() {
  const { t, lang, dir } = useI18n();
  const { name } = useBrand();
  const { data, isLoading, isError, refetch } = useMenu();
  const { closed } = useOrderingClosed();
  const { query, setQuery } = useMenuSearch();
  // "" = nothing selected yet (no products shown), ALL = every product
  const [selected, setSelected] = useState<string>("");
  const [limit, setLimit] = useState(BATCH);
  const itemsRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const tokens = searchTokens(query);
  const searching = tokens.length > 0;

  // Single source of truth for what the page renders.
  const viewMode: "search" | "category" | "empty" = searching
    ? "search"
    : selected
      ? "category"
      : "empty";

  // Selecting a category clears any active search and scrolls the list into view.
  const selectCategory = (value: string) => {
    setQuery("");
    setSelected(value);
    setLimit(BATCH);
    requestAnimationFrame(() => {
      itemsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const matched = useMemo(() => {
    if (!data) return [];
    if (viewMode === "search") {
      const catById = new Map(data.categories.map((c) => [c.id, c]));
      return data.products.filter((p) => {
        const c = p.category_id ? catById.get(p.category_id) : undefined;
        // Always matches both languages, whatever the UI language is.
        return matchesTokens(tokens, p.name_ar, p.name_en, c?.name_ar, c?.name_en);
      });
    }
    if (viewMode === "empty") return [];
    if (selected === ALL) return data.products;
    return data.products.filter((p) => p.category_id === selected);
  }, [data, tokens, viewMode, selected]);

  const lazy = viewMode === "category" && selected === ALL;
  const visible = lazy ? matched.slice(0, limit) : matched;
  const hasMore = lazy && limit < matched.length;

  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setLimit((n) => n + BATCH);
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, visible.length]);

  const { data: images } = useSignedUrls(
    "menu-images",
    visible.map((p) => p.image_url),
  );

  const catName = (id: string | null) => {
    if (!id) return undefined;
    const c = data?.categories.find((x) => x.id === id);
    return c ? pickName(lang, c.name_ar, c.name_en) : undefined;
  };

  const categories = data?.categories ?? [];

  if (closed) return <OrderingClosedScreen />;


  return (
    <div className="min-h-screen">
      <SiteHeader />

      {/* Hero — the uploaded image is the centerpiece: never cropped, never stretched. */}
      <section className="relative isolate overflow-hidden">
        <div
          className="absolute inset-0 bg-linear-to-b from-brand-softer via-background to-background"
          aria-hidden="true"
        />
        <div className="relative mx-auto flex max-w-6xl flex-col items-center px-4 pb-8 pt-6 text-center sm:pb-8 sm:pt-6">
          <img
            src="/hero.webp"
            alt={name}
            className="mx-auto max-h-[46vh] w-auto max-w-full object-contain sm:max-h-[18rem]"
            loading="eager"
            fetchPriority="high"
          />
          <h1 className="krunshy-display mt-4 text-3xl leading-tight text-foreground sm:mt-2 sm:text-5xl">
            {"\n"}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:mt-1 sm:text-base">{"\n"}</p>
          <a
            href="#menu"
            onClick={(e) => {
              e.preventDefault();
              document
                .getElementById("menu")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-7 text-sm font-extrabold text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:mt-4 sm:text-base"
          >
            {t("exploreMenu")}
            <ChevronDown className="size-4" aria-hidden="true" />
          </a>
        </div>
      </section>

      <main
        id="menu"
        dir={dir}
        className="mx-auto w-full max-w-6xl scroll-mt-20 overflow-x-hidden px-4 pb-28 pt-8"
      >
        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : (
          <>
            {categories.length > 0 && (
              <nav aria-label={t("categories")} className="mb-6">
                <ul className="flex flex-wrap gap-2">
                  {categories.map((c) => (
                    <li key={c.id}>
                      <Chip
                        active={selected === c.id}
                        label={pickName(lang, c.name_ar, c.name_en)}
                        onClick={() => selectCategory(c.id)}
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
              <div ref={itemsRef} className="scroll-mt-20">
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
              </div>
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
