import { createFileRoute, Link } from "@tanstack/react-router";
import { DualName } from "@/components/dual-name";
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
    ar: "تم إرسال طلبك بنجاح",
    en: "We received your order and sent it to the cashier. It will be confirmed shortly.",
  },
  confirmed: {
    ar: "تم تأكيد طلبك بنجاح\nوجاري تحضيره الآن\nسنقوم بإبلاغك فور الانتهاء منه",
    en: "Your order has been confirmed and is now being prepared. We'll let you know as soon as it's ready.",
  },
  preparing: { ar: "جاري تحضير طلبك", en: "Your order is being prepared." },
  ready: { ar: "طلبك جاهز", en: "Your order is ready." },
  completed: { ar: "تم إنهاء طلبك بنجاح\nشكراً لإختيارك لنا\nCrunchy Food", en: "Your order was confirmed and completed." },
  cancelled: { ar: "تم إلغاء طلبك", en: "Your order has been cancelled." },
};


const SHOW_POWERED_BY_CREDIT = false;

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
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-16 pb-28 text-center">
        {order.isLoading ? (
          <LoadingState />
        ) : !row ? (
          <EmptyState title={dict["noData"]![uiLang]} />
        ) : (
          <>
            <Icon
              className={`size-14 ${status === "cancelled" ? "text-destructive" : status === "completed" ? "text-success" : "text-primary"}`}
            />
            <h1 className="whitespace-pre-line text-xl font-extrabold">{copy[status]![lang]}</h1>
            <p className="text-sm text-muted-foreground">{money(row.total)}</p>

            <a
              href="https://ipn.eg/S/karanshy/instapay/2f73mB"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm font-medium text-primary transition hover:bg-accent/50"
            >
              <img src="/instapay-logo.png" alt="Instapay" className="h-5 w-auto" loading="lazy" />
              {lang === "ar" ? "ادفع عبر Instapay" : "Pay by Instapay"}
            </a>

            {(items.data?.length ?? 0) > 0 && (
              <ul className="mt-4 w-full divide-y divide-border rounded-lg border border-border bg-card text-start text-sm">
                {items.data?.map((it, i) => (
                  <li key={i} className="flex items-center gap-2 px-3 py-2">
                    <span className="flex-1 truncate">
                      <DualName ar={it.product_name} en={it.product_name_en} />
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

      {SHOW_POWERED_BY_CREDIT && (
        <footer className="fixed inset-x-0 bottom-0 z-50 flex justify-center bg-gradient-to-t from-background via-background/95 to-transparent px-4 pb-4 pt-8 text-center">
          <a
            href="https://wa.me/201038290203?text=مرحبًا،%20شفت%20نظام%20تتبع%20الطلبات%20بتاعكم%20وحابب%20أعرف%20تفاصيل%20أكتر%20عن%20عمل%20نظام%20مشابه"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-sky-600 transition-colors hover:bg-sky-500/10 hover:text-sky-700 dark:text-sky-400 dark:hover:bg-sky-500/10"
          >
            Powered by @Ai-Solutions
          </a>
        </footer>
      )}
    </div>
  );
}
