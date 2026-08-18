import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useI18n, pickName } from "@/lib/i18n";
import { useMenu } from "@/lib/menu";
import { supabase } from "@/integrations/supabase/client";
import { useSignedUrls } from "@/lib/storage";
import { SiteHeader } from "@/components/site-header";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { ProductCard } from "@/components/menu/product-card";
import { CartBar } from "@/components/menu/cart-bar";

export const Route = createFileRoute("/category/$categoryId")({
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("categories")
      .select("id,name_ar,name_en")
      .eq("id", params.categoryId)
      .maybeSingle();
    return { category: data ?? null };
  },
  head: ({ params, loaderData }) => {
    const cat = loaderData?.category;
    const label = cat ? (cat.name_ar || cat.name_en || "") : "";
    const title = label ? `${label} — Krunshy` : "Menu category — Krunshy";
    const description = label
      ? `تصفح أصناف قسم ${label} من منيو Krunshy وأضفها إلى طلبك مباشرة.`
      : "Browse the items in this Krunshy menu category and add them to your order.";
    const url = `https://crunchy-food.lovable.app/category/${params.categoryId}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { property: "og:image", content: "https://crunchy-food.lovable.app/og-image.jpg" },
        { name: "twitter:image", content: "https://crunchy-food.lovable.app/og-image.jpg" },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: title,
            description,
            url,
            isPartOf: { "@type": "WebSite", name: "Krunshy", url: "https://crunchy-food.lovable.app/" },
          }),
        },
      ],
    };
  },
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
    <div className="min-h-screen">
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
          <>
            <h2 className="mb-3 text-lg font-bold">
              {lang === "ar" ? `أصناف ${categoryLabel}` : `${categoryLabel} items`}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {items.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  image={p.image_url ? images?.[p.image_url] : undefined}
                  categoryLabel={categoryLabel}
                />
              ))}
            </div>
          </>
        )}
      </main>

      <CartBar />
    </div>
  );
}
