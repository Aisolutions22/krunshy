import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useMoney } from "@/lib/settings";
import { SiteHeader } from "@/components/site-header";
import { EmptyState, LoadingState } from "@/components/states";
import { OrderStatusBadge, type OrderStatus } from "@/components/order-badges";
import { formatDateTime } from "@/lib/dates";
import { readGuestOrders, type GuestOrder } from "@/lib/guest-orders";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/my-orders")({
  head: () => ({
    meta: [
      { title: "طلباتي السابقة — Krunshy" },
      { name: "description", content: "استعرض طلباتك السابقة على هذا الجهاز وتابع حالتها." },
      { property: "og:title", content: "طلباتي السابقة — Krunshy" },
      { property: "og:description", content: "استعرض طلباتك السابقة وتابع حالتها." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyOrdersPage,
});

type TrackRow = {
  order_number: number;
  status: OrderStatus;
  total: number;
  created_at: string;
};

function MyOrdersPage() {
  const { t, lang } = useI18n();
  const money = useMoney();
  const [stored, setStored] = useState<GuestOrder[]>([]);

  useEffect(() => {
    setStored(readGuestOrders());
  }, []);

  const orders = useQuery({
    queryKey: ["guest-orders", stored.map((o) => o.token)],
    enabled: stored.length > 0,
    refetchInterval: 15000,
    queryFn: async () => {
      const results = await Promise.all(
        stored.map(async (g) => {
          const { data } = await supabase.rpc("order_track_by_token", { _client_token: g.token });
          const row = ((data ?? []) as TrackRow[])[0];
          return row ? { ...g, row } : null;
        }),
      );
      return results.filter((r): r is GuestOrder & { row: TrackRow } => r !== null);
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-8">
        <h1 className="text-2xl font-extrabold">طلباتي السابقة</h1>
        {stored.length === 0 ? (
          <EmptyState
            title={t("noData")}
            action={
              <Button asChild className="mt-2">
                <Link to="/">{t("browseMenu")}</Link>
              </Button>
            }
          />
        ) : orders.isLoading ? (
          <LoadingState />
        ) : (
          <ul className="space-y-2">
            {(orders.data ?? []).map((o) => (
              <li key={o.token}>
                <Card>
                  <CardContent className="flex flex-wrap items-center gap-3 p-3">
                    <span className="font-bold">#{o.row.order_number}</span>
                    <span className="text-sm text-muted-foreground">
                      {formatDateTime(o.row.created_at, lang)}
                    </span>
                    <OrderStatusBadge status={o.row.status} />
                    <span className="ms-auto font-extrabold">{money(o.row.total)}</span>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/track/$token" params={{ token: o.token }}>
                        {t("orderDetails")}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
