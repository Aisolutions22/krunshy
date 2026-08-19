import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, pickName } from "@/lib/i18n";
import { searchTokens, matchesTokens } from "@/lib/search";
import { Input } from "@/components/ui/input";

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
      const [orders, payments, expenses, accounts, collections] = await Promise.all([
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
        // Collections = actual cash received: CASH orders dated by completion
        // (orders.paid_at) + account/credit customer payments dated by payments.paid_on.
        // Same shared source as the dashboard.
        supabase.rpc("collections_total", {
          _from: startOfDayIso(range.from),
          _to: endOfDayIso(range.to),
        }),
      ]);

      if (orders.error) throw orders.error;
      if (collections.error) throw collections.error;
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
        collections: (collections.data ?? []).reduce((sum, order) => sum + Number(order.total), 0),
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

type ItemSalesRow = {
  product_id: string | null;
  name_ar: string | null;
  name_en: string | null;
  quantity_sold: number;
  revenue: number;
};

function ItemSales({ range }: { range: DateRange }) {
  const { t, lang } = useI18n();
  const money = useMoney();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: "name" | "quantity_sold" | "revenue"; dir: "asc" | "desc" }>({
    key: "quantity_sold",
    dir: "desc",
  });

  const query = useQuery({
    queryKey: ["item-sales", range],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("product_sales_report", {
        _from: startOfDayIso(range.from),
        _to: endOfDayIso(range.to),
      });
      if (error) throw error;
      return (data ?? []) as ItemSalesRow[];
    },
  });

  const tokens = searchTokens(q);
  const rows = (query.data ?? [])
    .filter((r) => matchesTokens(tokens, r.name_ar, r.name_en))
    .map((r) => ({ ...r, name: pickName(lang, r.name_ar ?? "", r.name_en ?? "") }))
    .sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      if (sort.key === "name") return a.name.localeCompare(b.name, lang === "ar" ? "ar" : "en") * dir;
      return (Number(a[sort.key]) - Number(b[sort.key])) * dir;
    });

  const toggle = (key: "name" | "quantity_sold" | "revenue") =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));

  const Th = ({ k, label, align }: { k: "name" | "quantity_sold" | "revenue"; label: string; align?: string }) => (
    <th className={`px-3 py-2 ${align ?? "text-start"}`}>
      <button type="button" onClick={() => toggle(k)} className="font-semibold hover:underline">
        {label}
        {sort.key === k ? (sort.dir === "desc" ? " ↓" : " ↑") : ""}
      </button>
    </th>
  );

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{t("salesByItem")}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("searchItems")}
            className="h-9 w-48 bg-card"
          />
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={() =>
              downloadCsv(
                "item-sales.csv",
                toCsv(rows, [
                  { key: "name", label: t("product") },
                  { key: "quantity_sold", label: t("quantitySold") },
                  { key: "revenue", label: t("revenue") },
                ]),
              )
            }
          >
            <FileDown className="size-4" />
            {t("exportItemSales")}
          </Button>
        </div>
      </div>

      {query.isLoading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">{t("noData")}</CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-muted-foreground">
                <tr>
                  <Th k="name" label={t("product")} />
                  <Th k="quantity_sold" label={t("quantitySold")} align="text-end" />
                  <Th k="revenue" label={t("revenue")} align="text-end" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.product_id ?? `row-${i}`} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2">{r.name}</td>
                    <td className="px-3 py-2 text-end font-bold">{r.quantity_sold}</td>
                    <td className="px-3 py-2 text-end">{money(Number(r.revenue))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </section>
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
