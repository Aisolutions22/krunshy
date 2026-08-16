import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useMoney } from "@/lib/settings";
import { DateFilter } from "@/components/date-filter";
import { LoadingState } from "@/components/states";
import { toCsv, downloadCsv } from "@/lib/csv";
import {
  endOfDayIso,
  formatDate,
  formatDateTime,
  rangeForPreset,
  startOfDayIso,
  type DateRange,
  type PresetKey,
} from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/admin/reports")({
  component: AdminReports,
});

function AdminReports() {
  const { t, lang } = useI18n();
  const money = useMoney();
  const [preset, setPreset] = useState<PresetKey>("thisMonth");
  const [custom, setCustom] = useState<DateRange>(rangeForPreset("thisMonth"));
  const range = preset === "customRange" ? custom : rangeForPreset(preset);

  const data = useQuery({
    queryKey: ["admin-reports", range],
    queryFn: async () => {
      const [orders, payments, expenses, accounts] = await Promise.all([
        supabase
          .from("orders")
          .select("order_number,order_type,status,payment_status,total,created_at,visitor_name")
          .gte("created_at", startOfDayIso(range.from))
          .lte("created_at", endOfDayIso(range.to))
          .order("created_at", { ascending: false }),
        supabase
          .from("payments")
          .select("amount,method,paid_on,notes")
          .gte("paid_on", range.from)
          .lte("paid_on", range.to),
        supabase
          .from("expenses")
          .select("description,category,amount,spent_on")
          .gte("spent_on", range.from)
          .lte("spent_on", range.to),
        supabase.rpc("customer_accounts_summary"),
      ]);
      if (orders.error) throw orders.error;
      // Only completed orders are recognized as revenue — confirmed is purely
      // operational ("kitchen started") and must not count as sales.
      const recognized = (orders.data ?? []).filter((o) => o.status === "completed");
      const revenue = recognized.reduce((s, o) => s + Number(o.total), 0);
      const exp = (expenses.data ?? []).reduce((s, e) => s + Number(e.amount), 0);
      return {
        orders: orders.data ?? [],
        payments: payments.data ?? [],
        expenses: expenses.data ?? [],
        accounts: (accounts.data ?? []) as unknown as {
          display_name: string | null;
          full_name: string | null;
          email: string;
          total_ordered: number;
          total_paid: number;
          balance: number;
        }[],
        revenue,
        exp,
        collections: (payments.data ?? []).reduce((s, p) => s + Number(p.amount), 0),
        net: revenue - exp,
      };
    },
  });

  const d = data.data;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold">{t("reports")}</h1>
      <DateFilter
        preset={preset}
        custom={custom}
        onChange={(p, c) => {
          setPreset(p);
          setCustom(c);
        }}
      />

      {data.isLoading || !d ? (
        <LoadingState />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label={t("revenue")} value={money(d.revenue)} />
            <Metric label={t("collections")} value={money(d.collections)} />
            <Metric label={t("totalExpenses")} value={money(d.exp)} />
            <Metric label={t("netProfit")} value={money(d.net)} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={() =>
                downloadCsv(
                  "orders.csv",
                  toCsv(
                    d.orders.map((o) => ({
                      ...o,
                      created_at: formatDateTime(o.created_at, lang),
                      order_type: t(`type_${o.order_type}`),
                      status: t(`st_${o.status}`),
                    })),
                    [
                      { key: "order_number", label: t("orderNumber") },
                      { key: "created_at", label: t("date") },
                      { key: "visitor_name", label: t("customer") },
                      { key: "order_type", label: t("orderType") },
                      { key: "status", label: t("status") },
                      { key: "payment_status", label: t("paymentStatus") },
                      { key: "total", label: t("total") },
                    ],
                  ),
                )
              }
            >
              <FileDown className="size-4" />
              {t("exportOrders")}
            </Button>
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={() =>
                downloadCsv(
                  "payments.csv",
                  toCsv(
                    d.payments.map((p) => ({ ...p, paid_on: formatDate(p.paid_on, lang) })),
                    [
                      { key: "paid_on", label: t("date") },
                      { key: "method", label: t("method") },
                      { key: "amount", label: t("amount") },
                      { key: "notes", label: t("notes") },
                    ],
                  ),
                )
              }
            >
              <FileDown className="size-4" />
              {t("exportPayments")}
            </Button>
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={() =>
                downloadCsv(
                  "expenses.csv",
                  toCsv(
                    d.expenses.map((e) => ({ ...e, spent_on: formatDate(e.spent_on, lang) })),
                    [
                      { key: "spent_on", label: t("date") },
                      { key: "description", label: t("description") },
                      { key: "category", label: t("category") },
                      { key: "amount", label: t("amount") },
                    ],
                  ),
                )
              }
            >
              <FileDown className="size-4" />
              {t("exportExpenses")}
            </Button>
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={() =>
                downloadCsv(
                  "accounts.csv",
                  toCsv(
                    d.accounts.map((a) => ({
                      name: a.display_name ?? a.full_name ?? a.email,
                      total_ordered: a.total_ordered,
                      total_paid: a.total_paid,
                      balance: a.balance,
                    })),
                    [
                      { key: "name", label: t("customer") },
                      { key: "total_ordered", label: t("totalOrders") },
                      { key: "total_paid", label: t("totalPaid") },
                      { key: "balance", label: t("balance") },
                    ],
                  ),
                )
              }
            >
              <FileDown className="size-4" />
              {t("exportCustomers")}
            </Button>
          </div>

          <ItemSales range={range} />
        </>
      )}

    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-xl font-extrabold">{value}</p>
      </CardContent>
    </Card>
  );
}
