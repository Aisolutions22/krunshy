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
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import {
  EnableSoundPrompt,
  OrderAlertStack,
  OrderAlertsProvider,
  useOrderAlerts,
} from "@/lib/order-alerts";
import { BrandMark, LanguageToggle } from "@/components/site-header";
import { LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});


const nav = [
  { to: "/admin", exact: true, key: "dashboard", icon: LayoutDashboard },
  { to: "/admin/menu", key: "menuMgmt", icon: UtensilsCrossed },
  { to: "/admin/orders", key: "orders", icon: ReceiptText },
  { to: "/admin/customers", key: "customers", icon: Users },
  { to: "/admin/expenses", key: "expenses", icon: Wallet },
  { to: "/admin/reports", key: "reports", icon: BarChart3 },
  { to: "/admin/integrations", key: "integrations", icon: Plug },
  { to: "/admin/settings", key: "settings", icon: SettingsIcon },
] as const;

function AdminLayout() {
  const { t } = useI18n();
  const { isAdmin, loading, user, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);

  if (loading) return <LoadingState />;

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="text-xl font-bold">{t("adminOnly")}</h1>
        <Button asChild>
          <Link to="/">{t("browseMenu")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
          <BrandMark />
          <span className="hidden text-xs font-semibold uppercase tracking-widest text-muted-foreground sm:inline">
            {t("admin")}
          </span>
          <div className="ms-auto flex items-center gap-1">
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
          {nav.map((item) => {
            const active = "exact" in item && item.exact ? pathname === item.to : pathname.startsWith(item.to);
            const Icon = item.icon;
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
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
