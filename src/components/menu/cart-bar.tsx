import { Link } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useCart } from "@/lib/cart";
import { useMoney } from "@/lib/settings";

/** Fixed cart FAB — same spot regardless of scroll, RTL-safe via logical inset. */
export function CartBar() {
  const { t } = useI18n();
  const cart = useCart();
  const money = useMoney();
  if (cart.count === 0) return null;

  return (
    <Link
      to="/cart"
      aria-label={t("checkout")}
      className="fixed bottom-4 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-full bg-krunshy-red px-5 py-3 text-white shadow-lg shadow-black/25 transition hover:bg-krunshy-red/90"
      style={{ insetInlineEnd: "1rem" }}
    >
      <span className="relative shrink-0">
        <ShoppingBag className="size-5" />
        <span className="absolute -top-2 min-w-4 rounded-full bg-krunshy-amber px-1 text-center text-[10px] font-extrabold leading-4 text-krunshy-dark" style={{ insetInlineEnd: "-0.5rem" }}>
          {cart.count}
        </span>
      </span>
      <span className="truncate text-sm font-extrabold">{money(cart.total)}</span>
      <span className="hidden text-sm font-bold sm:inline">{t("checkout")}</span>
    </Link>
  );
}
