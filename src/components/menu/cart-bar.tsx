import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { useCart } from "@/lib/cart";
import { useMoney } from "@/lib/settings";
import { Button } from "@/components/ui/button";

export function CartBar() {
  const { t } = useI18n();
  const cart = useCart();
  const money = useMoney();
  if (cart.count === 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 p-3 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-1">
        <div className="text-sm">
          <span className="font-semibold">{cart.count}</span>{" "}
          <span className="text-muted-foreground">{t("items")}</span>
          <span className="mx-2 text-muted-foreground">·</span>
          <span className="font-extrabold">{money(cart.total)}</span>
        </div>
        <Button asChild className="ms-auto bg-krunshy-red font-bold text-white hover:bg-krunshy-red/90">
          <Link to="/cart">{t("checkout")}</Link>
        </Button>
      </div>
    </div>
  );
}
