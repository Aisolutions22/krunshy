import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Globe,
  LogOut,
  Menu,
  Moon,
  Search,
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
import { useMenuSearch } from "@/lib/menu-search";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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
  const { name } = useBrand();
  return (
    <Link
      to="/"
      aria-label={name}
      className={`flex min-w-0 items-center gap-2 ${centered ? "justify-center" : ""}`}
    >
      <img src="/logo.webp" alt={name} className="max-h-9 w-auto max-w-[7.5rem] object-contain" />
    </Link>
  );
}

/** Full-width search overlay — never competes with the header row for space. */
function SearchOverlay() {
  const { t } = useI18n();
  const { query, setQuery, open, setOpen } = useMenuSearch();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && pathname !== "/") void navigate({ to: "/" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      <DialogContent
        className="top-4 max-w-2xl translate-y-0 p-4"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <DialogTitle className="sr-only">{t("search")}</DialogTitle>
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground"
          />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search")}
            aria-label={t("search")}
            className="h-12 w-full ps-9 text-base"
          />
        </div>
        <p className="text-xs text-muted-foreground">{t("searchResults")}</p>
      </DialogContent>
    </Dialog>
  );
}

function SearchButton() {
  const { t } = useI18n();
  const { setOpen } = useMenuSearch();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="size-11 px-0"
      aria-label={t("search")}
      title={t("search")}
      onClick={() => setOpen(true)}
    >
      <Search className="size-4" />
    </Button>
  );
}

function DrawerRow({
  icon,
  label,
  onClick,
  to,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  to?: string;
}) {
  const cls =
    "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start text-sm font-semibold hover:bg-muted";
  if (to) {
    return (
      <Link to={to} onClick={onClick} className={cls}>
        <span className="shrink-0 text-muted-foreground">{icon}</span>
        <span className="truncate">{label}</span>
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function MobileDrawer({ showGuestOrders }: { showGuestOrders: boolean }) {
  const { t, lang, setLang } = useI18n();
  const { mode, toggleMode } = useMenuTheme();
  const { user, isAdmin, signOut } = useAuth();
  const { setOpen: setSearchOpen } = useMenuSearch();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="sm"
        className="size-11 px-0 sm:hidden"
        aria-label="القائمة"
        onClick={() => setOpen(true)}
      >
        <Menu className="size-5" />
      </Button>
      <SheetContent side={lang === "ar" ? "right" : "left"} className="w-72 p-4">
        <SheetTitle className="sr-only">القائمة</SheetTitle>
        <nav className="mt-6 flex flex-col gap-1">
          <DrawerRow
            icon={<Search className="size-4" />}
            label={t("search")}
            onClick={() => {
              close();
              setSearchOpen(true);
            }}
          />
          <DrawerRow
            icon={mode === "day" ? <Moon className="size-4" /> : <Sun className="size-4" />}
            label={mode === "day" ? t("nightMode") : t("dayMode")}
            onClick={toggleMode}
          />
          <DrawerRow
            icon={<Globe className="size-4" />}
            label={lang === "ar" ? "English" : "العربية"}
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
          />
          {isAdmin && (
            <DrawerRow
              icon={<LayoutDashboard className="size-4" />}
              label={t("admin")}
              to="/admin"
              onClick={close}
            />
          )}
          {showGuestOrders && !user && (
            <DrawerRow
              icon={<ClipboardList className="size-4" />}
              label="طلباتي السابقة"
              to="/my-orders"
              onClick={close}
            />
          )}
          {user ? (
            <>
              <DrawerRow
                icon={<UserRound className="size-4" />}
                label={t("myAccount")}
                to="/account"
                onClick={close}
              />
              <DrawerRow
                icon={<LogOut className="size-4" />}
                label={t("signOut")}
                onClick={() => {
                  close();
                  void signOut();
                }}
              />
            </>
          ) : (
            <DrawerRow
              icon={<UserRound className="size-4" />}
              label={t("signIn")}
              to="/auth"
              onClick={close}
            />
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

function CartButton() {
  const { t } = useI18n();
  const { count } = useCart();
  return (
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
  );
}

export function SiteHeader() {
  const { t } = useI18n();
  const { user, isAdmin, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [showGuestOrders, setShowGuestOrders] = useState(false);

  useEffect(() => {
    setShowGuestOrders(hasGuestOrders());
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto grid h-16 max-w-6xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1 px-2 sm:px-4">
        {/* start */}
        <div className="flex min-w-0 items-center justify-start">
          <MobileDrawer showGuestOrders={showGuestOrders} />
          <div className="hidden items-center sm:flex">
            <SearchButton />
            <span className="mx-1 h-6 w-px bg-border" aria-hidden />
            <MenuModeToggle />
            <LanguageToggle />
          </div>
        </div>

        {/* centered brand */}
        <BrandMark centered />

        {/* end */}
        <div className="flex min-w-0 items-center justify-end">
          <div className="hidden items-center sm:flex">
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
                  <span>{t("signIn")}</span>
                </Link>
              </Button>
            )}
            <span className="mx-1 h-6 w-px bg-border" aria-hidden />
          </div>

          {user && <NotificationsBell audience="customer" />}
          {pathname !== "/cart" && <CartButton />}
        </div>
      </div>
      <SearchOverlay />
    </header>
  );
}
