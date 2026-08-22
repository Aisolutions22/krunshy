import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { UserPlus, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { LoadingState, EmptyState } from "@/components/states";
import {
  adminCreateSalesStaff,
  adminSetStaffActive,
  adminSetStaffPermissions,
} from "@/lib/admin-users.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PasswordInput } from "@/components/ui/password-input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/staff")({
  component: AdminStaff,
});

const PAGES = [
  { key: "orders", label: "الطلبات" },
  { key: "menu", label: "إدارة المنيو" },
  { key: "customers", label: "العملاء والحسابات" },
  { key: "expenses", label: "المصاريف" },
  { key: "reports", label: "التقارير" },
] as const;

type PageKey = (typeof PAGES)[number]["key"];

type StaffRow = {
  id: string;
  email: string;
  full_name: string | null;
  display_name: string | null;
  is_active: boolean;
  staff_allowed_pages: string[] | null;
};

function PermissionsChecklist({
  value,
  onChange,
  idPrefix,
}: {
  value: PageKey[];
  onChange: (next: PageKey[]) => void;
  idPrefix: string;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <p className="text-sm font-semibold">الصلاحيات</p>
      {PAGES.map((page) => {
        const id = `${idPrefix}-${page.key}`;
        const checked = value.includes(page.key);
        return (
          <div key={page.key} className="flex items-center gap-2">
            <Checkbox
              id={id}
              checked={checked}
              onCheckedChange={(next) =>
                onChange(next ? [...value, page.key] : value.filter((p) => p !== page.key))
              }
            />
            <Label htmlFor={id} className="cursor-pointer font-normal">
              {page.label}
            </Label>
          </div>
        );
      })}
    </div>
  );
}

function AdminStaff() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { isAdmin, isSalesStaff, loading } = useAuth();
  const createStaff = useServerFn(adminCreateSalesStaff);
  const setActive = useServerFn(adminSetStaffActive);
  const setPermissions = useServerFn(adminSetStaffPermissions);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", password: "" });
  const [newPages, setNewPages] = useState<PageKey[]>([]);
  const [permsFor, setPermsFor] = useState<StaffRow | null>(null);
  const [permsDraft, setPermsDraft] = useState<PageKey[]>([]);

  useEffect(() => {
    if (!loading && isSalesStaff && !isAdmin) void navigate({ to: "/admin/orders", replace: true });
  }, [loading, isSalesStaff, isAdmin, navigate]);

  const staff = useQuery({
    queryKey: ["admin-staff"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "sales_staff");
      if (rolesError) throw rolesError;
      const ids = (roles ?? []).map((r) => r.user_id);
      if (ids.length === 0) return [] as StaffRow[];
      const { data, error } = await supabase
        .from("profiles")
        .select("id,email,full_name,display_name,is_active,staff_allowed_pages")
        .in("id", ids)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as StaffRow[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const res = (await createStaff({ data: form })) as { userId?: string };
      if (res?.userId && newPages.length > 0) {
        await setPermissions({ data: { userId: res.userId, allowedPages: newPages } });
      }
      return res;
    },
    onSuccess: () => {
      toast.success("تم إنشاء حساب موظف المبيعات");
      setOpen(false);
      setForm({ fullName: "", email: "", password: "" });
      setNewPages([]);
      void qc.invalidateQueries({ queryKey: ["admin-staff"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "حدث خطأ"),
  });

  const toggle = useMutation({
    mutationFn: async (row: StaffRow) => setActive({ data: { userId: row.id, isActive: !row.is_active } }),
    onSuccess: () => {
      toast.success("تم تحديث حالة الموظف");
      void qc.invalidateQueries({ queryKey: ["admin-staff"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "حدث خطأ"),
  });

  const savePerms = useMutation({
    mutationFn: async () => {
      if (!permsFor) return;
      await setPermissions({ data: { userId: permsFor.id, allowedPages: permsDraft } });
    },
    onSuccess: () => {
      toast.success("تم تحديث صلاحيات الموظف");
      setPermsFor(null);
      void qc.invalidateQueries({ queryKey: ["admin-staff"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "حدث خطأ"),
  });

  if (loading || !isAdmin) return <LoadingState />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold">الموظفين</h1>
        <Button className="gap-1.5" onClick={() => setOpen(true)}>
          <UserPlus className="size-4" />
          إضافة موظف مبيعات
        </Button>
      </div>

      {staff.isLoading ? (
        <LoadingState />
      ) : (staff.data ?? []).length === 0 ? (
        <EmptyState title="لا يوجد موظفون بعد" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-muted-foreground">
                  <tr>
                    <th className="p-3 text-start font-medium">الاسم</th>
                    <th className="p-3 text-start font-medium">البريد الإلكتروني</th>
                    <th className="p-3 text-start font-medium">الصلاحيات</th>
                    <th className="p-3 text-start font-medium">الحالة</th>
                    <th className="p-3 text-start font-medium">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {(staff.data ?? []).map((row) => {
                    const pages = (row.staff_allowed_pages ?? []) as PageKey[];
                    return (
                      <tr key={row.id} className="border-b border-border last:border-0">
                        <td className="p-3 font-medium">{row.display_name || row.full_name || "—"}</td>
                        <td className="p-3 text-muted-foreground">{row.email}</td>
                        <td className="p-3">
                          {pages.length === 0 ? (
                            <span className="text-muted-foreground">لا توجد صلاحيات</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {pages.map((p) => (
                                <Badge key={p} variant="secondary">
                                  {PAGES.find((x) => x.key === p)?.label ?? p}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <Badge variant={row.is_active ? "default" : "secondary"}>
                            {row.is_active ? "نشط" : "معطّل"}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5"
                              onClick={() => {
                                setPermsFor(row);
                                setPermsDraft(pages);
                              }}
                            >
                              <ShieldCheck className="size-4" />
                              الصلاحيات
                            </Button>
                            <Button
                              size="sm"
                              variant={row.is_active ? "destructive" : "outline"}
                              disabled={toggle.isPending}
                              onClick={() => toggle.mutate(row)}
                            >
                              {row.is_active ? "تعطيل" : "تفعيل"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إضافة موظف مبيعات</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="staff-name">الاسم</Label>
              <Input
                id="staff-name"
                value={form.fullName}
                maxLength={100}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staff-email">البريد الإلكتروني</Label>
              <Input
                id="staff-email"
                name="new-staff-email"
                type="email"
                autoComplete="off"
                value={form.email}
                maxLength={255}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staff-password">كلمة المرور (8 أحرف على الأقل)</Label>
              <PasswordInput
                id="staff-password"
                name="new-staff-password"
                autoComplete="new-password"
                value={form.password}
                minLength={8}
                maxLength={72}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <PermissionsChecklist idPrefix="new-staff" value={newPages} onChange={setNewPages} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
            <Button disabled={create.isPending} onClick={() => create.mutate()}>
              إنشاء الحساب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={permsFor !== null} onOpenChange={(o) => !o && setPermsFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>صلاحيات {permsFor?.display_name || permsFor?.full_name || permsFor?.email}</DialogTitle>
          </DialogHeader>
          <PermissionsChecklist idPrefix="edit-staff" value={permsDraft} onChange={setPermsDraft} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPermsFor(null)}>
              إلغاء
            </Button>
            <Button disabled={savePerms.isPending} onClick={() => savePerms.mutate()}>
              حفظ الصلاحيات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
