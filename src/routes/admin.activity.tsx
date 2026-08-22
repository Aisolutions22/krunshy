import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { CustomerName } from "@/components/admin/customer-name";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/dates";

export const Route = createFileRoute("/admin/activity")({
  component: AdminActivity,
});

const ACTION_AR: Record<string, string> = {
  create: "إضافة",
  update: "تعديل",
  archive: "أرشفة",
  unarchive: "استرجاع",
  delete: "حذف",
  approval_approved: "الموافقة على حساب موظف",
  approval_rejected: "رفض حساب موظف",
  approval_pending: "إرجاع حساب موظف للمراجعة",
  record_payment: "تسجيل دفعة",
  close_account: "تقفيل حساب عميل",
  mark_paid: "تعليم طلب كمدفوع",
  order_status: "تغيير حالة الطلب",
  toggle_ordering: "فتح/إغلاق استقبال الطلبات",
  void_payment: "إلغاء دفعة",
  admin_create_sales_staff: "إضافة موظف مبيعات",
  admin_set_staff_permissions: "تعديل صلاحيات موظف",
  admin_set_staff_active: "تفعيل/إيقاف موظف",
  admin_reset_password: "إعادة تعيين كلمة مرور",
};

const ENTITY_AR: Record<string, string> = {
  product: "صنف في القائمة",
  category: "قسم في القائمة",
  order: "طلب",
  profile: "حساب موظف",
  payment: "دفعة",
  expense: "مصروف",
  settings: "إعدادات المطعم",
  account_closing: "تقفيل حساب",
};

const STATUS_AR: Record<string, string> = {
  pending: "قيد الانتظار",
  confirmed: "مؤكد",
  preparing: "قيد التحضير",
  ready: "جاهز",
  completed: "مكتمل",
  cancelled: "ملغي",
};

type Json = Record<string, unknown> | null;

type LogRow = {
  id: string;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  previous_value: Json;
  new_value: Json;
  created_at: string;
};

function details(row: LogRow): string {
  const prev = row.previous_value;
  const next = row.new_value;
  const entityAr = ENTITY_AR[row.entity] ?? row.entity;
  const name = (next?.["name_ar"] as string) || (next?.["description"] as string) || "";
  switch (row.action) {
    case "order_status":
      return `من ${STATUS_AR[String(prev?.["status"])] ?? "—"} إلى ${STATUS_AR[String(next?.["status"])] ?? "—"}`;
    case "toggle_ordering":
      return next?.["is_ordering_open"] === true ? "تم فتح استقبال الطلبات" : "تم إغلاق استقبال الطلبات";
    case "record_payment":
      return `بمبلغ ${String(next?.["amount"] ?? "")} جنيه`;
    case "void_payment":
      return `بمبلغ ${String(prev?.["amount"] ?? "")} جنيه`;
    case "update":
      if (prev?.["price"] !== undefined && next?.["price"] !== undefined && prev["price"] !== next["price"]) {
        return `${entityAr}${name ? `: ${name}` : ""} — السعر من ${String(prev["price"])} إلى ${String(next["price"])}`;
      }
      return `${entityAr}${name ? `: ${name}` : ""}`;
    default:
      return `${entityAr}${name ? `: ${name}` : ""}`;
  }
}

function AdminActivity() {
  const { lang } = useI18n();
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!loading && !isAdmin) void navigate({ to: "/admin/orders", replace: true });
  }, [loading, isAdmin, navigate]);

  const logs = useQuery({
    queryKey: ["admin-activity"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id,actor_id,action,entity,entity_id,previous_value,new_value,created_at")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      const rows = (data ?? []) as unknown as LogRow[];
      const ids = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))] as string[];
      const actors = new Map<string, { display_name: string | null; full_name: string | null; email: string | null }>();
      if (ids.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id,display_name,full_name,email")
          .in("id", ids);
        for (const p of profiles ?? []) actors.set(p.id, p);
      }
      return rows.map((r) => ({ ...r, actor: r.actor_id ? (actors.get(r.actor_id) ?? null) : null }));
    },
  });

  const term = q.trim().toLowerCase();
  const rows = (logs.data ?? []).filter((r) => {
    if (!term) return true;
    const actorName = r.actor?.display_name ?? r.actor?.full_name ?? r.actor?.email ?? "";
    return (
      actorName.toLowerCase().includes(term) ||
      (ACTION_AR[r.action] ?? r.action).includes(term) ||
      details(r).toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold">سجل العمليات</h1>

      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="بحث بالاسم أو الإجراء"
        className="w-64 max-w-full bg-card"
      />

      {logs.isLoading ? (
        <LoadingState />
      ) : logs.isError ? (
        <ErrorState onRetry={() => void logs.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <span className="font-bold">{ACTION_AR[r.action] ?? r.action}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{details(r)}</span>
                <CustomerName
                  className="min-w-0 max-w-48"
                  primaryClassName="font-medium"
                  displayName={r.actor?.display_name ?? null}
                  fullName={r.actor?.full_name ?? null}
                  email={r.actor?.email ?? null}
                  fallback="النظام"
                />
                <span className="text-xs text-muted-foreground">{formatDateTime(r.created_at, lang)}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
