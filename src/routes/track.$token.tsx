import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChefHat, Clock, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, dict } from "@/lib/i18n";
import { useMoney } from "@/lib/settings";
import { SiteHeader } from "@/components/site-header";
import { LoadingState, EmptyState } from "@/components/states";
import { hasGuestOrders } from "@/lib/guest-orders";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/track/$token")({
  head: () => ({
    meta: [
      { title: "Track your order — Krunshy" },
      { name: "description", content: "Follow your Krunshy order live from received to ready." },
      { property: "og:title", content: "Track your order — Krunshy" },
      { property: "og:description", content: "Follow your Krunshy order live." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrackPage,
});

type TrackRow = {
  order_number: number;
  status: "pending" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled";
  order_type: "CASH" | "ACCOUNT";
  total: number;
  customer_language: string;
  created_at: string;
};

type TrackItem = {
  product_name: string;
  product_name_en: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
};

const copy: Record<string, { ar: string; en: string }> = {
  pending: {
    ar: "تم استلام طلبك وتحويله للكاشير، وسيتم تأكيده قريبًا",
    en: "We received your order and sent it to the cashier. It will be confirmed shortly.",
  },
  confirmed: {
    ar: "تم تأكيد طلبك بنجاح\nوجاري تحضيره\nوسنقوم بإبلاغك فور الانتهاء",
    en: "Your order has been confirmed and is now being prepared. We'll let you know as soon as it's ready.",
  },
  preparing: { ar: "جاري تحضير طلبك", en: "Your order is being prepared." },
  ready: { ar: "طلبك جاهز", en: "Your order is ready." },
  completed: { ar: "تم تأكيد وتنفيذ طلبك", en: "Your order was confirmed and completed." },
  cancelled: { ar: "تم إلغاء طلبك", en: "Your order has been cancelled." },
};


function TrackPage() {
  const { token } = Route.useParams();
  const { t, lang: uiLang } = useI18n();
  const money = useMoney();

  const order = useQuery({
    queryKey: ["track", token],
    refetchInterval: 5000,
    queryFn: async (): Promise<TrackRow | null> => {
      const { data, error } = await supabase.rpc("order_track_by_token", { _client_token: token });
      if (error) throw error;
      const rows = (data ?? []) as TrackRow[];
      return rows[0] ?? null;
    },
  });

  const items = useQuery({
    queryKey: ["track-items", token],
    queryFn: async (): Promise<TrackItem[]> => {
      const { data, error } = await supabase.rpc("order_track_items_by_token", { _client_token: token });
      if (error) throw error;
      return (data ?? []) as TrackItem[];
    },
  });

  const row = order.data;
  const lang = (row?.customer_language === "en" ? "en" : row?.customer_language === "ar" ? "ar" : uiLang) as
    | "ar"
    | "en";
  const status = row?.status ?? "pending";
  const Icon =
    status === "cancelled"
      ? XCircle
      : status === "completed"
        ? CheckCircle2
        : status === "confirmed" || status === "preparing" || status === "ready"
          ? ChefHat
          : Clock;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-16 text-center">
        {order.isLoading ? (
          <LoadingState />
        ) : !row ? (
          <EmptyState title={dict["noData"]![uiLang]} />
        ) : (
          <>
            <Icon
              className={`size-14 ${status === "cancelled" ? "text-destructive" : status === "completed" ? "text-success" : "text-primary"}`}
            />
            <p className="text-lg font-bold text-primary">
              {t("orderNumber")} {row.order_number}
            </p>
            <h1 className="whitespace-pre-line text-xl font-extrabold">{copy[status]![lang]}</h1>
            <p className="text-sm text-muted-foreground">{money(row.total)}</p>

            {(items.data?.length ?? 0) > 0 && (
              <ul className="mt-4 w-full divide-y divide-border rounded-lg border border-border bg-card text-start text-sm">
                {items.data?.map((it, i) => (
                  <li key={i} className="flex items-center gap-2 px-3 py-2">
                    <span className="flex-1 truncate">
                      {lang === "en" ? (it.product_name_en ?? it.product_name) : it.product_name}
                    </span>
                    <span className="text-muted-foreground">×{it.quantity}</span>
                    <span className="text-muted-foreground">{money(it.unit_price)}</span>
                    <span className="font-semibold">{money(it.line_total)}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 flex gap-2">
              <Button asChild>
                <Link to="/">{t("browseMenu")}</Link>
              </Button>
              {hasGuestOrders() && (
                <Button asChild variant="outline">
                  <Link to="/my-orders">طلباتي السابقة</Link>
                </Button>
              )}
            </div>
          </>
        )}

      </main>
    </div>
  );
}
