import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Globe,
  LogOut,
  Moon,
  ShoppingBag,
  Sun,
  UserRound,
  LayoutDashboard,
  ClipboardList,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useMenuTheme } from "@/lib/menu-theme";
import { useAuth } from "@/lib/auth";
import { useBrand } from "@/lib/settings";
import { useCart } from "@/lib/cart";
import { hasGuestOrders } from "@/lib/guest-orders";
import { useSignedUrls } from "@/lib/storage";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NotificationsBell } from "@/components/notifications-bell";

export function LanguageToggle() {
  const { lang, setLang } = useI18n();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1.5"
      onClick={() => setLang(lang === "ar" ? "en" : "ar")}
      aria-label="Switch language"
    >
      <Globe className="size-4" />
      <span className="text-xs font-semibold">{lang === "ar" ? "EN" : "ع"}</span>
    </Button>
  );
}

export function MenuModeToggle() {
  const { mode, toggleMode } = useMenuTheme();
  const { t } = useI18n();
  const label = mode === "day" ? t("nightMode") : t("dayMode");
  return (
    <Button variant="ghost" size="sm" onClick={toggleMode} aria-label={label} title={label}>
      {mode === "day" ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </Button>
  );
}

export function BrandMark() {
  const { name, settings } = useBrand();
  const { data: urls } = useSignedUrls("brand-assets", [settings?.logo_url]);
  const logo = settings?.logo_url ? urls?.[settings.logo_url] : undefined;
  return (
    <Link to="/" className="flex items-center gap-2">
      {logo ? (
        <img src={logo} alt={name} className="size-9 rounded-lg object-cover" />
      ) : (
        <span className="grid size-9 place-items-center rounded-lg bg-primary text-sm font-extrabold text-primary-foreground">
          {name.slice(0, 2)}
        </span>
      )}
      <span className="text-lg font-extrabold tracking-tight">{name}</span>
    </Link>
  );
}

export function SiteHeader() {
  const { t } = useI18n();
  const { user, isAdmin, signOut } = useAuth();
  const { count } = useCart();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [showGuestOrders, setShowGuestOrders] = useState(false);

  useEffect(() => {
    setShowGuestOrders(hasGuestOrders());
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4">
        <BrandMark />
        <div className="ms-auto flex items-center gap-1">
          <MenuModeToggle />
          <LanguageToggle />
          {showGuestOrders && !user && (
            <Button asChild variant="ghost" size="sm" className="gap-1.5">
              <Link to="/my-orders">
                <ClipboardList className="size-4" />
                <span className="hidden sm:inline">طلباتي السابقة</span>
              </Link>
            </Button>
          )}

          {isAdmin && (
            <Button asChild variant="ghost" size="sm" className="gap-1.5">
              <Link to="/admin">
                <LayoutDashboard className="size-4" />
                <span className="hidden sm:inline">{t("admin")}</span>
              </Link>
            </Button>
          )}
          {user ? (
            <>
              <NotificationsBell audience="customer" />
              <Button asChild variant="ghost" size="sm" className="gap-1.5">
                <Link to="/account">
                  <UserRound className="size-4" />
                  <span className="hidden sm:inline">{t("myAccount")}</span>
                </Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void signOut()} aria-label={t("signOut")}>
                <LogOut className="size-4" />
              </Button>
            </>
          ) : (
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth">{t("signIn")}</Link>
            </Button>
          )}
          {pathname !== "/cart" && (
            <Button asChild size="sm" className="relative hidden gap-1.5 sm:inline-flex">
              <Link to="/cart">
                <ShoppingBag className="size-4" />
                <span className="hidden sm:inline">{t("cart")}</span>
                {count > 0 && (
                  <Badge className="min-w-5 justify-center px-1 py-0 text-[10px]" variant="secondary">
                    {count}
                  </Badge>
                )}
              </Link>
            </Button>
          )}

        </div>
      </div>
    </header>
  );
}
