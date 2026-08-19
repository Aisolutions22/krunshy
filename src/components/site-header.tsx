import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Globe,
  LogOut,
  Moon,
  Search,
  ShoppingBag,
  Sun,
  UserRound,
  LayoutDashboard,
  ClipboardList,
  X,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useMenuTheme } from "@/lib/menu-theme";
import { useAuth } from "@/lib/auth";
import { useBrand } from "@/lib/settings";
import { useCart } from "@/lib/cart";
import { hasGuestOrders } from "@/lib/guest-orders";
import { useSignedUrls } from "@/lib/storage";
import { useMenuSearch } from "@/lib/menu-search";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NotificationsBell } from "@/components/notifications-bell";

export function LanguageToggle() {
  const { lang, setLang } = useI18n();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="size-11 px-0"
      onClick={() => setLang(lang === "ar" ? "en" : "ar")}
      aria-label="Switch language"
      title="Switch language"
    >
      <Globe className="size-4" />
      <span className="sr-only">{lang === "ar" ? "EN" : "ع"}</span>
    </Button>
  );
}

export function MenuModeToggle() {
  const { mode, toggleMode } = useMenuTheme();
  const { t } = useI18n();
  const label = mode === "day" ? t("nightMode") : t("dayMode");
  return (
    <Button
      variant="ghost"
      size="sm"
      className="size-11 px-0"
      onClick={toggleMode}
      aria-label={label}
      title={label}
    >
      {mode === "day" ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </Button>
  );
}

export function BrandMark({ centered = false }: { centered?: boolean }) {
  const { name, settings } = useBrand();
  const { data: urls } = useSignedUrls("brand-assets", [settings?.logo_url]);
  const logo = settings?.logo_url ? urls?.[settings.logo_url] : undefined;
  return (
    <Link
      to="/"
      aria-label={name}
      className={`flex min-w-0 items-center gap-2 ${centered ? "justify-center" : ""}`}
    >
      {logo ? (
        <img
          src={logo}
          alt={name}
          className={centered ? "max-h-11 w-auto max-w-[9rem] object-contain" : "size-9 shrink-0 rounded-lg object-cover"}
        />
      ) : (
        <>
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-sm font-extrabold text-primary-foreground">
            {name.slice(0, 2)}
          </span>
          <span className="truncate text-base font-extrabold tracking-tight sm:text-lg">{name}</span>
        </>
      )}
    </Link>
  );
}

/** Icon → compact field. Layout-stable on desktop, full-width row on mobile. */
function SearchUtility() {
  const { t } = useI18n();
  const { query, setQuery, open, setOpen } = useMenuSearch();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="size-11 px-0"
        aria-label={t("search")}
        title={t("search")}
        onClick={() => {
          setOpen(true);
          if (pathname !== "/") void navigate({ to: "/" });
        }}
      >
        <Search className="size-4" />
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute inset-y-0 start-2.5 my-auto size-4 text-muted-foreground"
        />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setQuery("");
              setOpen(false);
            }
          }}
          placeholder={t("search")}
          aria-label={t("search")}
          className="h-11 w-[9.5rem] ps-8 sm:w-56"
        />
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="size-11 px-0"
        aria-label={t("close")}
        onClick={() => {
          setQuery("");
          setOpen(false);
        }}
      >
        <X className="size-4" />
      </Button>
    </div>
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
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto grid h-16 max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-1 px-2 sm:px-4">
        {/* start utilities */}
        <div className="flex min-w-0 items-center justify-start">
          <SearchUtility />
          <div className="hidden items-center sm:flex">
            <MenuModeToggle />
            <LanguageToggle />
          </div>
        </div>

        {/* centered brand */}
        <BrandMark centered />

        {/* end utilities */}
        <div className="flex min-w-0 items-center justify-end">
          <div className="flex items-center sm:hidden">
            <MenuModeToggle />
          </div>

          {showGuestOrders && !user && (
            <Button asChild variant="ghost" size="sm" className="h-11 gap-1.5">
              <Link to="/my-orders" aria-label="طلباتي السابقة">
                <ClipboardList className="size-4" />
                <span className="hidden lg:inline">طلباتي السابقة</span>
              </Link>
            </Button>
          )}

          {isAdmin && (
            <Button asChild variant="ghost" size="sm" className="h-11 gap-1.5">
              <Link to="/admin" aria-label={t("admin")}>
                <LayoutDashboard className="size-4" />
                <span className="hidden lg:inline">{t("admin")}</span>
              </Link>
            </Button>
          )}

          {user ? (
            <>
              <NotificationsBell audience="customer" />
              <Button asChild variant="ghost" size="sm" className="h-11 gap-1.5">
                <Link to="/account" aria-label={t("myAccount")}>
                  <UserRound className="size-4" />
                  <span className="hidden lg:inline">{t("myAccount")}</span>
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="size-11 px-0"
                onClick={() => void signOut()}
                aria-label={t("signOut")}
              >
                <LogOut className="size-4" />
              </Button>
            </>
          ) : (
            <Button asChild variant="ghost" size="sm" className="h-11 px-2 sm:px-3">
              <Link to="/auth" aria-label={t("signIn")}>
                <UserRound className="size-4 sm:hidden" />
                <span className="hidden sm:inline">{t("signIn")}</span>
              </Link>
            </Button>
          )}

          {pathname !== "/cart" && (
            <Button asChild variant="ghost" size="sm" className="relative h-11 gap-1.5">
              <Link to="/cart" aria-label={t("cart")}>
                <ShoppingBag className="size-4" />
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
