import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useMoney } from "@/lib/settings";
import { useAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { LoadingState, EmptyState } from "@/components/states";
import { OrderStatusBadge, PaymentBadge } from "@/components/order-badges";
import { formatDateTime, formatDate } from "@/lib/dates";
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

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);

  const orders = useQuery({
    queryKey: ["my-orders", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id,order_number,order_type,status,payment_status,total,created_at,notes")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const payments = useQuery({
    queryKey: ["my-payments", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id,amount,method,paid_on,notes")
        .order("paid_on", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const totalOrdered = (orders.data ?? [])
    .filter((o) => o.order_type === "ACCOUNT" && o.status !== "cancelled")
    .reduce((s, o) => s + Number(o.total), 0);
  const totalPaid = (payments.data ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const balance = totalOrdered - totalPaid;

  if (loading || !user) return <LoadingState />;

  const status = profile?.approval_status ?? "pending";

  return (
    <div className="min-h-screen bg-background">
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

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label={t("totalOrders")} value={money(totalOrdered)} />
          <StatCard label={t("totalPaid")} value={money(totalPaid)} />
          <StatCard label={t("balance")} value={money(balance)} highlight={balance > 0} />
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t("orders")}</CardTitle>
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
