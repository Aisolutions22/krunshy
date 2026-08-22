import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useMoney } from "@/lib/settings";
import { useAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { DateFilter } from "@/components/date-filter";
import { LoadingState, EmptyState } from "@/components/states";
import { formatDate, rangeForPreset, todayInCairo, type DateRange, type PresetKey } from "@/lib/dates";
import { usePresetRange } from "@/lib/use-date-range";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/expenses")({
  component: AdminExpenses,
});

const cats = ["food", "supplies", "utilities", "other"] as const;

const emptyExpense = {
  description: "",
  amount: "",
  category: "food" as string,
  spent_on: todayInCairo(),
  notes: "",
};

function AdminExpenses() {
  const navigateGuard = useNavigate();
  const { isAdmin: guardIsAdmin, isSalesStaff: guardIsSalesStaff, loading: guardLoading } = useAuth();
  useEffect(() => {
    if (!guardLoading && guardIsSalesStaff && !guardIsAdmin) void navigateGuard({ to: "/admin/orders", replace: true });
  }, [guardLoading, guardIsSalesStaff, guardIsAdmin, navigateGuard]);
  const { t, lang } = useI18n();
  const money = useMoney();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [preset, setPreset] = useState<PresetKey>("thisMonth");
  const [custom, setCustom] = useState<DateRange>(rangeForPreset("thisMonth"));
  const [dialog, setDialog] = useState<typeof emptyExpense | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const range = usePresetRange(preset, custom);

  const list = useQuery({
    queryKey: ["admin-expenses", range],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .gte("spent_on", range.from)
        .lte("spent_on", range.to)
        .order("spent_on", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async (e: typeof emptyExpense) => {
      const amount = Number(e.amount);
      if (!e.description.trim() || !Number.isFinite(amount) || amount <= 0) throw new Error(t("error"));
      const { error } = await supabase.from("expenses").insert({
        description: e.description.trim(),
        amount,
        category: e.category,
        spent_on: e.spent_on,
        notes: e.notes.trim() || null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
      await logAudit({ actorId: user?.id, action: "create", entity: "expense", newValue: e });
    },
    onSuccess: () => {
      setDialog(null);
      void qc.invalidateQueries({ queryKey: ["admin-expenses"] });
      void qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
      toast.success(t("saved"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
      await logAudit({ actorId: user?.id, action: "delete", entity: "expense", entityId: id });
    },
    onSuccess: () => {
      setDeleteId(null);
      void qc.invalidateQueries({ queryKey: ["admin-expenses"] });
      void qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
      toast.success(t("saved"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const total = (list.data ?? []).reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{t("expenses")}</h1>
        <Button onClick={() => setDialog({ ...emptyExpense })} className="gap-1.5">
          <Plus className="size-4" />
          {t("addExpense")}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <DateFilter
          preset={preset}
          custom={custom}
          onChange={(p, c) => {
            setPreset(p);
            setCustom(c);
          }}
        />
        <span className="ms-auto rounded-lg bg-accent px-3 py-1.5 text-sm font-bold text-accent-foreground">
          {t("totalExpenses")}: {money(total)}
        </span>
      </div>

      {list.isLoading ? (
        <LoadingState />
      ) : (list.data ?? []).length === 0 ? (
        <EmptyState />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {list.data?.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <span className="font-medium">{e.description}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {t(`exp_${e.category}` as "exp_food")}
                  </Badge>
                  <span className="text-muted-foreground">{formatDate(e.spent_on, lang)}</span>
                  {e.notes && <span className="truncate text-muted-foreground">{e.notes}</span>}
                  <span className="ms-auto font-bold">{money(e.amount)}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 text-destructive"
                    onClick={() => setDeleteId(e.id)}
                    aria-label={t("delete")}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Dialog open={Boolean(dialog)} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("addExpense")}</DialogTitle>
          </DialogHeader>
          {dialog && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>{t("description")}</Label>
                <Input
                  value={dialog.description}
                  onChange={(ev) => setDialog({ ...dialog, description: ev.target.value })}
                  maxLength={160}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("amount")}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={dialog.amount}
                    onChange={(ev) => setDialog({ ...dialog, amount: ev.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("date")}</Label>
                  <Input
                    type="date"
                    value={dialog.spent_on}
                    onChange={(ev) => setDialog({ ...dialog, spent_on: ev.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t("category")}</Label>
                <Select value={dialog.category} onValueChange={(v) => setDialog({ ...dialog, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {cats.map((c) => (
                      <SelectItem key={c} value={c}>
                        {t(`exp_${c}` as "exp_food")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>
                  {t("notes")} <span className="text-muted-foreground">({t("optional")})</span>
                </Label>
                <Textarea
                  rows={2}
                  value={dialog.notes}
                  onChange={(ev) => setDialog({ ...dialog, notes: ev.target.value })}
                  maxLength={300}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              {t("cancel")}
            </Button>
            <Button disabled={save.isPending} onClick={() => dialog && save.mutate(dialog)}>
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteId)} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("delete")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("deleteExpenseConfirm")}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => deleteId && remove.mutate(deleteId)}
            >
              {t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
