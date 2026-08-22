import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { DualName } from "@/components/dual-name";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, CheckCircle2, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, pickName } from "@/lib/i18n";

import { useMoney } from "@/lib/settings";
import { useAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { LoadingState, EmptyState } from "@/components/states";
import { OrderStatusBadge, PaymentBadge } from "@/components/order-badges";
import {
  formatDateTime,
  formatDate,
  rangeForPreset,
  startOfDayIso,
  endOfDayIso,
  type DateRange,
  type PresetKey,
} from "@/lib/dates";
import { DateFilter } from "@/components/date-filter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "My account — Krunshy" },
      { name: "description", content: "Track your Krunshy orders, account balance and payments." },
      { property: "og:title", content: "My account — Krunshy" },
      { property: "og:description", content: "Track your Krunshy orders and balance." },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { t, lang } = useI18n();
  const money = useMoney();
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Optional date narrowing applied ON TOP of the closing cutoff. Never affects the balance.
  const [preset, setPreset] = useState<PresetKey | null>(null);
  const [custom, setCustom] = useState<DateRange>(rangeForPreset("last7"));
  const range: DateRange | null = preset ? (preset === "customRange" ? custom : rangeForPreset(preset)) : null;

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);

  // The current statement starts after the most recent account closing.
  const closing = useQuery({
    queryKey: ["my-last-closing", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_closings")
        .select("id,closed_at,outstanding_after,period_end")
        .order("closed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const cutoff = closing.data?.closed_at ?? null;

  const orders = useQuery({
    queryKey: ["my-orders", user?.id, cutoff, range?.from ?? null, range?.to ?? null],
    enabled: Boolean(user) && !closing.isLoading,
    queryFn: async () => {
      let q = supabase
        .from("orders")
        .select("id,order_number,order_type,status,payment_status,total,created_at,notes")
        .order("created_at", { ascending: false })
        .limit(100);
      if (cutoff) q = q.gt("created_at", cutoff);
      if (range) {
        q = q.gte("created_at", startOfDayIso(range.from)).lte("created_at", endOfDayIso(range.to));
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const payments = useQuery({
    queryKey: ["my-payments", user?.id, cutoff, range?.from ?? null, range?.to ?? null],
    enabled: Boolean(user) && !closing.isLoading,
    queryFn: async () => {
      let q = supabase
        .from("payments")
        .select("id,amount,method,paid_on,notes,created_at")
        .order("paid_on", { ascending: false })
        .limit(50);
      if (cutoff) q = q.gt("created_at", cutoff);
      if (range) q = q.gte("paid_on", range.from).lte("paid_on", range.to);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Live sync: the moment an admin confirms an order or records a payment,
  // this page refetches instead of waiting for a manual refresh.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`account-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `customer_id=eq.${user.id}` },
        () => {
          void qc.invalidateQueries({ queryKey: ["my-balance"] });
          void qc.invalidateQueries({ queryKey: ["my-orders"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments", filter: `customer_id=eq.${user.id}` },
        () => {
          void qc.invalidateQueries({ queryKey: ["my-balance"] });
          void qc.invalidateQueries({ queryKey: ["my-payments"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, qc]);

  // Never recompute a financial figure client-side. The balance comes from the same
  // customer_balance() RPC the admin views use, so the two can never disagree.
  const balanceQuery = useQuery({
    queryKey: ["my-balance", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("customer_balance", { _customer_id: user!.id });
      if (error) throw error;
      return Number(data ?? 0);
    },
  });

  const totalOrdered = (orders.data ?? [])
    .filter((o) => o.order_type === "ACCOUNT" && (o.status === "confirmed" || o.status === "completed"))
    .reduce((s, o) => s + Number(o.total), 0);
  const totalPaid = (payments.data ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const balance = balanceQuery.data ?? 0;

  if (loading || !user) return <LoadingState />;

  const status = profile?.approval_status ?? "pending";

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-2xl font-extrabold">{profile?.display_name || profile?.full_name || t("myAccount")}</h1>
            <p className="text-sm text-muted-foreground">{profile?.email}</p>
          </div>
          <Badge
            className="ms-auto gap-1"
            variant={status === "approved" ? "default" : status === "rejected" ? "destructive" : "secondary"}
          >
            {status === "approved" ? (
              <CheckCircle2 className="size-3.5" />
            ) : status === "rejected" ? (
              <XCircle className="size-3.5" />
            ) : (
              <Clock className="size-3.5" />
            )}
            {status === "approved" ? t("approve") : status === "rejected" ? t("rejectedAccount") : t("pendingApproval")}
          </Badge>
        </div>

        {status === "pending" && (
          <Card className="border-warning/40 bg-warning/10">
            <CardContent className="p-4 text-sm">{t("pendingApprovalHint")}</CardContent>
          </Card>
        )}

        <Button asChild size="lg" className="w-full gap-2 text-base font-extrabold sm:w-auto">
          <Link to="/">{lang === "ar" ? "ابدأ طلب جديد" : "Start a new order"}</Link>
        </Button>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label={t("totalOrders")} value={money(totalOrdered)} />
          <StatCard label={t("totalPaid")} value={money(totalPaid)} />
          <StatCard label={t("balance")} value={money(balance)} highlight={balance < 0} />
        </div>

        {closing.data && (
          <Card className="border-primary/40">
            <CardContent className="flex flex-wrap items-center gap-2 p-4 text-sm">
              <span className="font-semibold">
                {t("openingBalance")} ({formatDate(closing.data.period_end, lang)})
              </span>
              <span className="ms-auto font-extrabold">{money(closing.data.outstanding_after)}</span>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <DateFilter
            preset={preset}
            custom={custom}
            placeholder={t("filterByDate")}
            onChange={(p, c) => {
              setPreset(p);
              setCustom(c);
            }}
            onClear={() => setPreset(null)}
          />
          {preset && (
            <span className="text-xs text-muted-foreground">
              {t("showingLabel")}: {t(preset)}
            </span>
          )}
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              {t("currentStatement")} — {t("orders")}
            </CardTitle>
            <Button asChild size="sm" variant="outline">
              <Link to="/">{t("newOrder")}</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {orders.isLoading ? (
              <LoadingState />
            ) : (orders.data?.length ?? 0) === 0 ? (
              <EmptyState hint={t("emptyCartHint")} />
            ) : (
              <ul className="divide-y divide-border">
                {orders.data?.map((o) => (
                  <OrderRow key={o.id} order={o} />
                ))}
              </ul>
            )}

          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("payments")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {(payments.data?.length ?? 0) === 0 ? (
              <EmptyState />
            ) : (
              <ul className="divide-y divide-border">
                {payments.data?.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="text-sm">{formatDate(p.paid_on, lang)}</span>
                    <span className="text-sm text-muted-foreground">{p.method}</span>
                    <span className="ms-auto font-semibold text-success">{money(p.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

type MyOrder = {
  id: string;
  order_number: number;
  order_type: "ACCOUNT" | "CASH";
  status: "pending" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled";
  payment_status: "paid" | "unpaid";
  total: number;
  created_at: string;
  notes: string | null;
};

function OrderRow({ order }: { order: MyOrder }) {
  const { t, lang } = useI18n();
  const money = useMoney();
  const [open, setOpen] = useState(false);

  const items = useQuery({
    queryKey: ["my-order-items", order.id],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("id,product_name_snapshot,product_name_en_snapshot,quantity,unit_price_snapshot,line_total")
        .eq("order_id", order.id)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-start hover:bg-muted/50"
      >
        {open ? <ChevronUp className="size-4 shrink-0" /> : <ChevronDown className="size-4 shrink-0" />}
        <span className="font-semibold">#{order.order_number}</span>
        <span className="text-sm text-muted-foreground">{formatDateTime(order.created_at, lang)}</span>
        <OrderStatusBadge status={order.status} />
        <PaymentBadge status={order.payment_status} />
        <span className="ms-auto font-bold">{money(order.total)}</span>
      </button>
      {open && (
        <div className="border-t border-border bg-muted/30 px-4 py-2">
          {items.isLoading ? (
            <LoadingState />
          ) : (
            <ul className="divide-y divide-border text-sm">
              {items.data?.map((it) => (
                <li key={it.id} className="flex items-center gap-2 py-2">
                  <span className="flex-1 truncate">
                    <DualName ar={it.product_name_snapshot} en={it.product_name_en_snapshot} />
                  </span>
                  <span className="text-muted-foreground">×{it.quantity}</span>
                  <span className="text-muted-foreground">{money(it.unit_price_snapshot)}</span>
                  <span className="font-semibold">{money(it.line_total)}</span>
                </li>
              ))}
            </ul>
          )}
          {order.notes && <p className="pb-2 text-xs text-muted-foreground">{order.notes}</p>}
          <div className="flex justify-between border-t border-border py-2 text-sm font-bold">
            <span>{t("total")}</span>
            <span>{money(order.total)}</span>
          </div>
        </div>
      )}
    </li>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={`mt-1 text-xl font-extrabold ${highlight ? "text-primary" : ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
