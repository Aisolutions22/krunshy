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
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:shadow-md">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {image ? (
          <img
            src={image}
            alt={pickName(lang, p.name_ar, p.name_en)}
            loading="lazy"
            className="size-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="grid size-full place-items-center bg-krunshy-dark/5 text-muted-foreground">
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
        {categoryLabel && (
          <p className="text-[11px] font-normal text-muted-foreground">{categoryLabel}</p>
        )}
        {(p.description_ar || p.description_en) && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {pickName(lang, p.description_ar, p.description_en)}
          </p>
        )}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2.5">
          <span className="rounded-full bg-krunshy-amber/15 px-2.5 py-1 text-xs font-extrabold text-krunshy-red sm:text-sm">
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
            className="min-h-11 gap-1 bg-krunshy-red px-4 font-bold text-white hover:bg-krunshy-red/90"
          >
            <Plus className="size-4" />
            {t("addToCart")}
          </Button>
        </div>
      </div>
    </article>
  );
}
