import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
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
      { title: "Krunshy — Online Food Ordering & Menu" },
      {
        name: "description",
        content:
          "Browse the full Krunshy menu and order online as a guest or on a company account — fast food ordering in Arabic and English.",
      },
      { property: "og:title", content: "Krunshy — Online Food Ordering & Menu" },
      {
        property: "og:description",
        content:
          "Browse the full Krunshy menu and order online as a guest or on a company account — fast food ordering in Arabic and English.",
      },
      { property: "og:url", content: "https://krunshy.lovable.app/" },
      { property: "og:image", content: "https://krunshy.lovable.app/og-image.jpg" },
      { name: "twitter:image", content: "https://krunshy.lovable.app/og-image.jpg" },
    ],
    links: [{ rel: "canonical", href: "https://krunshy.lovable.app/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Restaurant",
          name: "Krunshy",
          alternateName: "Crunchy",
          description:
            "Krunshy restaurant ordering and account management — browse the menu by category and order as a visitor or on a company account.",
          servesCuisine: "Fast food",
          url: "https://krunshy.lovable.app/",
          telephone: "01005382216",
          hasMenu: "https://krunshy.lovable.app/",
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
  const [query, setQuery] = useState("");
  // "" = nothing selected yet (no products shown), ALL = every product
  const [selected, setSelected] = useState<string>("");

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  const visible = useMemo(() => {
    if (!data) return [];
    if (searching) {
      return data.products.filter(
        (p) => p.name_ar.toLowerCase().includes(q) || (p.name_en ?? "").toLowerCase().includes(q),
      );
    }
    if (!selected) return [];
    if (selected === ALL) return data.products;
    return data.products.filter((p) => p.category_id === selected);
  }, [data, q, searching, selected]);

  const { data: images } = useSignedUrls("menu-images", visible.map((p) => p.image_url));

  const catName = (id: string | null) => {
    if (!id) return undefined;
    const c = data?.categories.find((x) => x.id === id);
    return c ? pickName(lang, c.name_ar, c.name_en) : undefined;
  };

  const categories = data?.categories ?? [];

  return (
    <MenuSurface>
      <SiteHeader />

      <section className="border-b border-krunshy-dark/10 bg-krunshy-dark text-white">
        <div className="mx-auto max-w-6xl px-4 py-8 text-center sm:py-10">
          <h1 className="krunshy-display text-3xl sm:text-4xl">
            {name}
            <span className="mx-2 text-white/40">—</span>
            <span className="text-2xl sm:text-3xl">
              {lang === "ar" ? "اطلب من المنيو" : "Order from the menu"}
            </span>
          </h1>
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

      <main dir={dir} className="mx-auto w-full max-w-6xl overflow-x-hidden px-4 pb-28 pt-6">
        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : (
          <>
            {categories.length > 0 && (
              <nav aria-label={t("categories")} className="mb-6">
                <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
                  {lang === "ar" ? "الأقسام" : "Categories"}
                </h2>
                <ul className="flex flex-wrap gap-2">
                  <li>
                    <Chip active={selected === ALL} label={t("all")} onClick={() => setSelected(ALL)} />
                  </li>
                  {categories.map((c) => (
                    <li key={c.id}>
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
              <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
                <p className="krunshy-display text-lg">{lang === "ar" ? "اختر قسمًا لعرض الأصناف" : "Pick a category to see items"}</p>
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
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
    </MenuSurface>
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
          ? "rounded-full border-2 border-krunshy-amber bg-krunshy-amber/20 px-4 py-2 text-sm font-extrabold text-krunshy-red transition"
          : "rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition hover:border-krunshy-amber/60"
      }
    >
      {label}
    </button>
  );
}
