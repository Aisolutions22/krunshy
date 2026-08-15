import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Wallet, CreditCard, Users, Receipt, PiggyBank } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useMoney } from "@/lib/settings";
import { DateFilter } from "@/components/date-filter";
import { LoadingState, EmptyState } from "@/components/states";
import { OrderStatusBadge, OrderTypeBadge, PaymentBadge } from "@/components/order-badges";
import {
  endOfDayIso,
  formatDateTime,
  rangeForPreset,
  startOfDayIso,
  type DateRange,
  type PresetKey,
} from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { t, lang } = useI18n();
  const money = useMoney();
  const [preset, setPreset] = useState<PresetKey>("today");
  const [custom, setCustom] = useState<DateRange>(rangeForPreset("today"));
  const range = preset === "customRange" ? custom : rangeForPreset(preset);

  const stats = useQuery({
    queryKey: ["admin-dashboard", range],
    queryFn: async () => {
      const from = startOfDayIso(range.from);
      const to = endOfDayIso(range.to);
      const [orders, payments, expenses, accounts, pending] = await Promise.all([
        supabase
          .from("orders")
          .select("id,order_number,order_type,status,payment_status,total,created_at,visitor_name")
          .gte("created_at", from)
          .lte("created_at", to)
          .order("created_at", { ascending: false }),
        supabase.from("payments").select("amount").gte("paid_on", range.from).lte("paid_on", range.to),
        supabase.from("expenses").select("amount").gte("spent_on", range.from).lte("spent_on", range.to),
        supabase.rpc("customer_accounts_summary"),
        supabase.from("profiles").select("id").eq("approval_status", "pending"),
      ]);
      if (orders.error) throw orders.error;
      // Single source of truth: revenue is recognized once an order is "confirmed"
      // (and stays recognized while "completed") — same rule as customer_balance()
      // and customer_accounts_summary(). Never reimplement financial math elsewhere.
      const recognized = (orders.data ?? []).filter(
        (o) => o.status === "confirmed" || o.status === "completed",
      );
      const sales = recognized.reduce((s, o) => s + Number(o.total), 0);
      const accountSales = recognized
        .filter((o) => o.order_type === "ACCOUNT")
        .reduce((s, o) => s + Number(o.total), 0);
      const cashSales = recognized
        .filter((o) => o.order_type === "CASH")
        .reduce((s, o) => s + Number(o.total), 0);
      const outstanding = (accounts.data ?? []).reduce(
        (s: number, a: { balance: number }) => s + Number(a.balance),
        0,
      );
      return {
        orders: orders.data ?? [],
        sales,
        accountSales,
        cashSales,
        collections: (payments.data ?? []).reduce((s, p) => s + Number(p.amount), 0),
        expenses: (expenses.data ?? []).reduce((s, e) => s + Number(e.amount), 0),
        outstanding,
        pendingCount: pending.data?.length ?? 0,
      };

    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{t("dashboard")}</h1>
        <DateFilter
          preset={preset}
          custom={custom}
          onChange={(p, c) => {
            setPreset(p);
            setCustom(c);
          }}
        />
      </div>

      {stats.isLoading ? (
        <LoadingState />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Stat icon={TrendingUp} label={t("todaySales")} value={money(stats.data?.sales)} accent />
            <Stat icon={CreditCard} label={t("accountSales")} value={money(stats.data?.accountSales)} />
            <Stat icon={Wallet} label={t("cashSales")} value={money(stats.data?.cashSales)} />
            <Stat icon={PiggyBank} label={t("collections")} value={money(stats.data?.collections)} />
            <Stat icon={Receipt} label={t("totalExpenses")} value={money(stats.data?.expenses)} />
            <Stat
              icon={Users}
              label={t("outstanding")}
              value={money(stats.data?.outstanding)}
              hint={
                (stats.data?.pendingCount ?? 0) > 0
                  ? `${stats.data?.pendingCount} · ${t("pendingRequests")}`
                  : undefined
              }
            />
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{t("recentOrders")}</CardTitle>
              <Button asChild size="sm" variant="outline">
                <Link to="/admin/orders">{t("orders")}</Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {(stats.data?.orders.length ?? 0) === 0 ? (
                <EmptyState />
              ) : (
                <ul className="divide-y divide-border">
                  {stats.data?.orders.slice(0, 12).map((o) => (
                    <li key={o.id} className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
                      <span className="font-semibold">#{o.order_number}</span>
                      <span className="text-muted-foreground">{formatDateTime(o.created_at, lang)}</span>
                      <span className="truncate">{o.visitor_name ?? t("customer")}</span>
                      <OrderTypeBadge type={o.order_type} />
                      <OrderStatusBadge status={o.status} />
                      <PaymentBadge status={o.payment_status} />
                      <span className="ms-auto font-bold">{money(o.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  hint?: string | undefined;
  accent?: boolean;
}) {
  return (
    <Card className={accent ? "border-primary/40" : undefined}>
      <CardContent className="flex items-start gap-3 p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="truncate text-xl font-extrabold">{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
