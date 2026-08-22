import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  LayoutDashboard,
  UtensilsCrossed,
  ReceiptText,
  Users,
  Wallet,
  BarChart3,
  Settings as SettingsIcon,
  Plug,
  Store,
  BadgeCheck,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { SoundToggle, OrderAlertStack, useOrderAlerts } from "@/lib/order-alerts";

import { BrandMark, LanguageToggle } from "@/components/site-header";
import { NotificationsBell } from "@/components/notifications-bell";
import { LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});


type NavRole = "admin" | "sales_staff";

const nav = [
  { to: "/admin", exact: true, key: "dashboard", icon: LayoutDashboard, roles: ["admin"] },
  { to: "/admin/menu", key: "menuMgmt", icon: UtensilsCrossed, roles: ["admin"] },
  { to: "/admin/orders", key: "orders", icon: ReceiptText, roles: ["admin", "sales_staff"] },
  { to: "/admin/customers", key: "customers", icon: Users, roles: ["admin"] },
  { to: "/admin/staff", key: "staff", icon: BadgeCheck, roles: ["admin"] },
  { to: "/admin/expenses", key: "expenses", icon: Wallet, roles: ["admin"] },
  { to: "/admin/reports", key: "reports", icon: BarChart3, roles: ["admin"] },
  { to: "/admin/integrations", key: "integrations", icon: Plug, roles: ["admin"] },
  { to: "/admin/settings", key: "settings", icon: SettingsIcon, roles: ["admin"] },
] as const satisfies ReadonlyArray<{
  to: string;
  exact?: boolean;
  key: string;
  icon: typeof LayoutDashboard;
  roles: ReadonlyArray<NavRole>;
}>;

function AdminLayout() {
  const { t } = useI18n();
  const { isAdmin, isSalesStaff, loading, user, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);

  if (loading) return <LoadingState />;

  if (!isAdmin && !isSalesStaff) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="text-xl font-bold">{t("adminOnly")}</h1>
        <Button asChild>
          <Link to="/">{t("browseMenu")}</Link>
        </Button>
      </div>
    );
  }

  return <AdminShell />;

}

function AdminShell() {
  const { t } = useI18n();
  const { signOut, isAdmin } = useAuth();
  const { unseenCount } = useOrderAlerts();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
          <BrandMark />
          <span className="hidden text-xs font-semibold uppercase tracking-widest text-muted-foreground sm:inline">
            {t("admin")}
          </span>
          <div className="ms-auto flex items-center gap-1">
            <SoundToggle />
            <NotificationsBell audience="admin" />
            <LanguageToggle />
            <Button asChild variant="ghost" size="sm" className="gap-1.5">
              <Link to="/">
                <Store className="size-4" />
                <span className="hidden sm:inline">{t("menu")}</span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void signOut()}>
              {t("signOut")}
            </Button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-3 pb-2">
          {nav
            .filter((item) => (item.roles as ReadonlyArray<NavRole>).includes(isAdmin ? "admin" : "sales_staff"))
            .map((item) => {
            const active = "exact" in item && item.exact ? pathname === item.to : pathname.startsWith(item.to);
            const Icon = item.icon;
            const badge = item.to === "/admin/orders" ? unseenCount : 0;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <Icon className="size-4" />
                {t(item.key)}
                {badge > 0 && (
                  <span className="ms-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-bold text-destructive-foreground">
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
      <OrderAlertStack />
    </div>
  );

}
