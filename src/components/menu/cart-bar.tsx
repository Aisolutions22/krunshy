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
  const empty = cart.count === 0;

  return (
    <Link
      to="/cart"
      aria-label={t("cart")}
      className={`fixed bottom-4 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-full bg-krunshy-red px-5 py-3 text-white shadow-lg shadow-black/25 transition hover:bg-krunshy-red/90 ${empty ? "sm:hidden" : ""}`}
      style={{ insetInlineEnd: "1rem" }}
    >
      <ShoppingBag className="size-5 shrink-0" />
      {empty ? (
        <span className="text-sm font-bold">{t("cart")}</span>
      ) : (
        <>
          <span className="min-w-5 rounded-full bg-krunshy-amber px-1.5 text-center text-xs font-extrabold leading-5 text-krunshy-dark">
            {cart.count}
          </span>
          <span className="truncate text-sm font-extrabold">{money(cart.total)}</span>
        </>
      )}
    </Link>
  );
}

