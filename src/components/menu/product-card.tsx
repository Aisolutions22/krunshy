import { Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { useI18n, pickName } from "@/lib/i18n";
import { useMoney } from "@/lib/settings";
import { useCart } from "@/lib/cart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type MenuProduct = {
  id: string;
  category_id: string | null;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  image_url: string | null;
  price: number;
  is_available: boolean;
};

export function ProductCard({
  product: p,
  image,
  categoryLabel,
}: {
  product: MenuProduct;
  image?: string | undefined;
  categoryLabel?: string | undefined;
}) {
  const { t, lang } = useI18n();
  const money = useMoney();
  const cart = useCart();
  const disabled = !p.is_available;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm transition hover:-translate-y-0.5 hover:border-brand-border hover:shadow-lg">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {image ? (
          <img
            src={image}
            alt={pickName(lang, p.name_ar, p.name_en)}
            loading="lazy"
            className="size-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="grid size-full place-items-center bg-brand-softer text-muted-foreground">
            <ShoppingBag className="size-8" />
          </div>
        )}
        {disabled && (
          <Badge variant="secondary" className="absolute top-2 end-2">
            {t("outOfStock")}
          </Badge>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-0.5 p-2.5 sm:p-3">
        <h3 className="krunshy-display text-sm leading-tight sm:text-base">
          {pickName(lang, p.name_ar, p.name_en)}
        </h3>
        {(() => {
          const primary = (pickName(lang, p.name_ar, p.name_en) ?? "").trim();
          const other = ((lang === "ar" ? p.name_en : p.name_ar) ?? "").trim();
          if (!other || other === primary) return null;
          return (
            <p dir="auto" className="truncate text-xs font-normal text-muted-foreground">
              {other}
            </p>
          );
        })()}
        {categoryLabel && (
          <p className="text-[11px] font-normal text-muted-foreground">{categoryLabel}</p>
        )}

        {(p.description_ar || p.description_en) && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {pickName(lang, p.description_ar, p.description_en)}
          </p>
        )}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2.5">
          <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-extrabold text-brand-strong sm:text-sm">
            {money(p.price)}
          </span>
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
            aria-label={t("addToCart")}
            className="min-h-11 gap-1 bg-primary px-3 text-xs font-bold text-primary-foreground hover:bg-primary/90 sm:px-4 sm:text-sm"
          >
            <Plus className="size-4" />
            {t("addToCart")}
          </Button>
        </div>
      </div>
    </article>
  );
}
