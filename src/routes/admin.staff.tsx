import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { LoadingState, EmptyState } from "@/components/states";
import { adminCreateSalesStaff, adminSetStaffActive } from "@/lib/admin-users.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/staff")({
  component: AdminStaff,
});

type StaffRow = {
  id: string;
  email: string;
  full_name: string | null;
  display_name: string | null;
  is_active: boolean;
};

function AdminStaff() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { isAdmin, isSalesStaff, loading } = useAuth();
  const createStaff = useServerFn(adminCreateSalesStaff);
  const setActive = useServerFn(adminSetStaffActive);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", password: "" });

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
        .select("id,email,full_name,display_name,is_active")
        .in("id", ids)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as StaffRow[];
    },
  });

  const create = useMutation({
    mutationFn: async () => createStaff({ data: form }),
    onSuccess: () => {
      toast.success("تم إنشاء حساب موظف المبيعات");
      setOpen(false);
      setForm({ fullName: "", email: "", password: "" });
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
                    <th className="p-3 text-start font-medium">الحالة</th>
                    <th className="p-3 text-start font-medium">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {(staff.data ?? []).map((row) => (
                    <tr key={row.id} className="border-b border-border last:border-0">
                      <td className="p-3 font-medium">{row.display_name || row.full_name || "—"}</td>
                      <td className="p-3 text-muted-foreground">{row.email}</td>
                      <td className="p-3">
                        <Badge variant={row.is_active ? "default" : "secondary"}>
                          {row.is_active ? "نشط" : "معطّل"}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Button
                          size="sm"
                          variant={row.is_active ? "destructive" : "outline"}
                          disabled={toggle.isPending}
                          onClick={() => toggle.mutate(row)}
                        >
                          {row.is_active ? "تعطيل" : "تفعيل"}
                        </Button>
                      </td>
                    </tr>
                  ))}
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
                type="email"
                value={form.email}
                maxLength={255}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staff-password">كلمة المرور (8 أحرف على الأقل)</Label>
              <PasswordInput
                id="staff-password"
                value={form.password}
                minLength={8}
                maxLength={72}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
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
    </div>
  );
}
