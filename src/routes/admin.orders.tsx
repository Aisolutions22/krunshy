import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, pickName } from "@/lib/i18n";
import { useMoney } from "@/lib/settings";
import { useAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { DateFilter } from "@/components/date-filter";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { OrderStatusBadge, OrderTypeBadge, PaymentBadge, type OrderStatus } from "@/components/order-badges";
import {
  endOfDayIso,
  formatDateTime,
  rangeForPreset,
  startOfDayIso,
  type DateRange,
  type PresetKey,
} from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/orders")({
  validateSearch: (search: Record<string, unknown>): { order?: string | undefined } => ({
    order: typeof search['order'] === "string" ? (search['order'] as string) : undefined,
  }),
  component: AdminOrders,
});



const statuses: OrderStatus[] = ["pending", "confirmed", "preparing", "ready", "completed", "cancelled"];

type OrderRow = {
  id: string;
  order_number: number;
  order_type: "ACCOUNT" | "CASH";
  status: OrderStatus;
  payment_status: "paid" | "unpaid";
  total: number;
  subtotal: number;
  notes: string | null;
  created_at: string;
  visitor_name: string | null;
  visitor_phone: string | null;
  customer_id: string | null;
  profiles: { full_name: string | null; display_name: string | null } | null;
};

function AdminOrders() {
  const { t, lang } = useI18n();
  const money = useMoney();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [preset, setPreset] = useState<PresetKey>("today");
  const [custom, setCustom] = useState<DateRange>(rangeForPreset("today"));
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const range = preset === "customRange" ? custom : rangeForPreset(preset);

  const orders = useQuery({
    queryKey: ["admin-orders", range, statusFilter, typeFilter],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select(
          "id,order_number,order_type,status,payment_status,total,subtotal,notes,created_at,visitor_name,visitor_phone,customer_id,profiles(full_name,display_name)",
        )
        .gte("created_at", startOfDayIso(range.from))
        .lte("created_at", endOfDayIso(range.to))
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") query = query.eq("status", statusFilter as OrderStatus);
      if (typeFilter !== "all") query = query.eq("order_type", typeFilter as "CASH" | "ACCOUNT");
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as OrderRow[];
    },
  });

  const detail = useQuery({
    queryKey: ["admin-order-items", detailId],
    enabled: Boolean(detailId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", detailId!)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ order, status }: { order: OrderRow; status: OrderStatus }) => {
      const { error } = await supabase.from("orders").update({ status }).eq("id", order.id);
      if (error) throw error;
      await logAudit({
        actorId: user?.id,
        action: "order_status",
        entity: "order",
        entityId: order.id,
        previousValue: { status: order.status },
        newValue: { status },
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-orders"] });
      toast.success(t("saved"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markPaid = useMutation({
    mutationFn: async (order: OrderRow) => {
      const { error } = await supabase
        .from("orders")
        .update({ payment_status: "paid", paid_at: new Date().toISOString(), paid_by: user?.id ?? null })
        .eq("id", order.id);
      if (error) throw error;
      if (order.order_type === "ACCOUNT" && order.customer_id) {
        const { error: payErr } = await supabase.from("payments").insert({
          customer_id: order.customer_id,
          order_id: order.id,
          amount: order.total,
          method: "cash",
          recorded_by: user?.id ?? null,
          paid_on: new Date().toISOString().slice(0, 10),
        });
        if (payErr) throw payErr;
      }
      await logAudit({
        actorId: user?.id,
        action: "mark_paid",
        entity: "order",
        entityId: order.id,
        newValue: { amount: order.total },
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-orders"] });
      void qc.invalidateQueries({ queryKey: ["admin-customers"] });
      toast.success(t("saved"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const term = q.trim().toLowerCase();
  const rows = (orders.data ?? []).filter((o) => {
    if (!term) return true;
    const name = o.profiles?.display_name ?? o.profiles?.full_name ?? o.visitor_name ?? "";
    return String(o.order_number).includes(term) || name.toLowerCase().includes(term);
  });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold">{t("orders")}</h1>

      <div className="flex flex-wrap items-center gap-2">
        <DateFilter
          preset={preset}
          custom={custom}
          onChange={(p, c) => {
            setPreset(p);
            setCustom(c);
          }}
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("all")}</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`st_${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("all")}</SelectItem>
            <SelectItem value="ACCOUNT">{t("type_ACCOUNT")}</SelectItem>
            <SelectItem value="CASH">{t("type_CASH")}</SelectItem>
          </SelectContent>
        </Select>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("search")}
          className="w-48 bg-card"
        />
      </div>

      {orders.isLoading ? (
        <LoadingState />
      ) : orders.isError ? (
        <ErrorState onRetry={() => void orders.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-2">
          {rows.map((o) => (
            <Card key={o.id}>
              <CardContent className="flex flex-wrap items-center gap-3 p-3">
                <button
                  className="text-start font-bold text-primary hover:underline"
                  onClick={() => setDetailId(o.id)}
                >
                  #{o.order_number}
                </button>
                <span className="text-sm text-muted-foreground">{formatDateTime(o.created_at, lang)}</span>
                <span className="truncate text-sm font-medium">
                  {o.profiles?.display_name ?? o.profiles?.full_name ?? o.visitor_name ?? t("visitor")}
                </span>
                <OrderTypeBadge type={o.order_type} />
                <PaymentBadge status={o.payment_status} />
                <span className="ms-auto font-extrabold">{money(o.total)}</span>
                <Select
                  value={o.status}
                  onValueChange={(v) => setStatus.mutate({ order: o, status: v as OrderStatus })}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(`st_${s}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {o.payment_status === "unpaid" && o.status !== "cancelled" && (
                  <Button size="sm" variant="outline" onClick={() => markPaid.mutate(o)}>
                    {t("markPaid")}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={Boolean(detailId)} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("orderDetails")}</DialogTitle>
          </DialogHeader>
          {detail.isLoading ? (
            <LoadingState />
          ) : (
            <ul className="divide-y divide-border text-sm">
              {(detail.data ?? []).map((it) => (
                <li key={it.id} className="flex items-center gap-2 py-2">
                  <span className="flex-1 truncate">
                    {pickName(lang, it.product_name_snapshot, it.product_name_en_snapshot)}
                  </span>
                  <span className="text-muted-foreground">×{it.quantity}</span>
                  <span className="font-semibold">{money(it.line_total)}</span>
                </li>
              ))}
            </ul>
          )}
          {(() => {
            const order = rows.find((r) => r.id === detailId);
            if (!order) return null;
            return (
              <div className="space-y-1 border-t border-border pt-3 text-sm">
                <div className="flex justify-between font-bold">
                  <span>{t("total")}</span>
                  <span>{money(order.total)}</span>
                </div>
                {order.visitor_phone && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t("visitorPhone")}</span>
                    <span dir="ltr">{order.visitor_phone}</span>
                  </div>
                )}
                {order.notes && <p className="text-muted-foreground">{order.notes}</p>}
                <div className="flex gap-2 pt-1">
                  <OrderStatusBadge status={order.status} />
                  <PaymentBadge status={order.payment_status} />
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
