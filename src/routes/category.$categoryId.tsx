import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useI18n, pickName } from "@/lib/i18n";
import { useMenu } from "@/lib/menu";
import { useSignedUrls } from "@/lib/storage";
import { SiteHeader } from "@/components/site-header";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { ProductCard } from "@/components/menu/product-card";
import { CartBar } from "@/components/menu/cart-bar";

export const Route = createFileRoute("/category/$categoryId")({
  head: () => ({
    meta: [
      { title: "Menu category — Krunshy" },
      { name: "description", content: "Browse the items in this Krunshy menu category and add them to your order." },
      { property: "og:title", content: "Menu category — Krunshy" },
      {
        property: "og:description",
        content: "Browse the items in this Krunshy menu category and add them to your order.",
      },
    ],
  }),
  component: CategoryPage,
});

function CategoryPage() {
  const { t, lang } = useI18n();
  const { categoryId } = Route.useParams();
  const { data, isLoading, isError, refetch } = useMenu();

  const category = data?.categories.find((c) => c.id === categoryId) ?? null;
  const items = useMemo(
    () => (data?.products ?? []).filter((p) => p.category_id === categoryId),
    [data, categoryId],
  );

  const imagePaths = useMemo(() => items.map((p) => p.image_url), [items]);
  const { data: images } = useSignedUrls("menu-images", imagePaths);

  const BackIcon = lang === "ar" ? ArrowRight : ArrowLeft;
  const categoryLabel = category ? pickName(lang, category.name_ar, category.name_en) : "";

  return (
    <div className="min-h-screen bg-krunshy-cream">
      <SiteHeader />

      <section className="bg-krunshy-dark text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-6">
          <Link
            to="/"
            aria-label={t("back")}
            className="grid size-10 shrink-0 place-items-center rounded-full border border-white/20 text-white transition hover:bg-white/10"
          >
            <BackIcon className="size-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="krunshy-display truncate text-2xl">{categoryLabel}</h1>
            {category && (
              <p className="truncate text-sm text-white/60">
                {lang === "ar" ? category.name_en : category.name_ar}
              </p>
            )}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-6">
        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : items.length === 0 ? (
          <EmptyState title={t("noData")} hint={t("browseMenu")} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                image={p.image_url ? images?.[p.image_url] : undefined}
                categoryLabel={categoryLabel}
              />
            ))}
          </div>
        )}
      </main>

      <CartBar />
    </div>
  );
}
