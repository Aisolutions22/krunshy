import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X, Wallet, FileDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useMoney } from "@/lib/settings";
import { useAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { LoadingState, EmptyState } from "@/components/states";
import { formatDate, formatDateTime, todayInCairo } from "@/lib/dates";
import { toCsv, downloadCsv } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/admin/customers")({
  component: AdminCustomers,
});

type Account = {
  customer_id: string;
  full_name: string | null;
  display_name: string | null;
  email: string;
  phone: string | null;
  department: string | null;
  approval_status: "pending" | "approved" | "rejected";
  total_ordered: number;
  total_paid: number;
  balance: number;
  last_order_at: string | null;
  last_payment_on: string | null;
};

function AdminCustomers() {
  const { t, lang } = useI18n();
  const money = useMoney();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [ledgerFor, setLedgerFor] = useState<Account | null>(null);
  const [payFor, setPayFor] = useState<Account | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payNotes, setPayNotes] = useState("");
  const [closeFor, setCloseFor] = useState<Account | null>(null);
  const [voidFor, setVoidFor] = useState<{ id: string; amount: number } | null>(null);

  const accounts = useQuery({
    queryKey: ["admin-customers"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("customer_accounts_summary");
      if (error) throw error;
      return (data ?? []) as unknown as Account[];
    },
  });

  const ledger = useQuery({
    queryKey: ["admin-ledger", ledgerFor?.customer_id],
    enabled: Boolean(ledgerFor),
    queryFn: async () => {
      const id = ledgerFor!.customer_id;
      const closings = await supabase
        .from("account_closings")
        .select("*")
        .eq("customer_id", id)
        .order("closed_at", { ascending: false });
      if (closings.error) throw closings.error;
      const lastClosing = closings.data?.[0] ?? null;
      const cutoff = lastClosing?.closed_at ?? null;

      let ordersQuery = supabase
        .from("orders")
        .select("id,order_number,total,created_at,status,payment_status")
        .eq("customer_id", id)
        .eq("order_type", "ACCOUNT")
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });
      let paymentsQuery = supabase
        .from("payments")
        .select("id,amount,method,paid_on,notes,created_at")
        .eq("customer_id", id)
        .order("paid_on", { ascending: false });
      if (cutoff) {
        ordersQuery = ordersQuery.gt("created_at", cutoff);
        paymentsQuery = paymentsQuery.gt("created_at", cutoff);
      }
      const [orders, payments] = await Promise.all([ordersQuery, paymentsQuery]);
      if (orders.error) throw orders.error;
      if (payments.error) throw payments.error;
      return {
        orders: orders.data ?? [],
        payments: payments.data ?? [],
        closings: closings.data ?? [],
        lastClosing,
      };
    },
  });

  const setApproval = useMutation({
    mutationFn: async ({ acc, status }: { acc: Account; status: "approved" | "rejected" }) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          approval_status: status,
          approved_at: status === "approved" ? new Date().toISOString() : null,
          approved_by: user?.id ?? null,
        })
        .eq("id", acc.customer_id);
      if (error) throw error;
      await logAudit({
        actorId: user?.id,
        action: `approval_${status}`,
        entity: "profile",
        entityId: acc.customer_id,
        previousValue: { approval_status: acc.approval_status },
        newValue: { approval_status: status },
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-customers"] });
      toast.success(t("saved"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const recordPayment = useMutation({
    mutationFn: async () => {
      const amount = Number(payAmount);
      if (!payFor || !Number.isFinite(amount) || amount <= 0) throw new Error(t("error"));
      const { error } = await supabase.from("payments").insert({
        customer_id: payFor.customer_id,
        amount,
        method: payMethod,
        notes: payNotes.trim() || null,
        recorded_by: user?.id ?? null,
        paid_on: todayInCairo(),
      });
      if (error) throw error;
      await logAudit({
        actorId: user?.id,
        action: "record_payment",
        entity: "payment",
        entityId: payFor.customer_id,
        newValue: { amount, method: payMethod },
      });
    },
    onSuccess: () => {
      setPayFor(null);
      setPayAmount("");
      setPayNotes("");
      void qc.invalidateQueries({ queryKey: ["admin-customers"] });
      void qc.invalidateQueries({ queryKey: ["admin-ledger"] });
      toast.success(t("saved"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const voidPayment = useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase.rpc("void_payment", { _payment_id: paymentId });
      if (error) throw error;
    },
    onSuccess: () => {
      setVoidFor(null);
      void qc.invalidateQueries({ queryKey: ["admin-customers"] });
      void qc.invalidateQueries({ queryKey: ["admin-ledger"] });
      toast.success(t("saved"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const closeAccount = useMutation({
    mutationFn: async (acc: Account) => {
      const { error } = await supabase.from("account_closings").insert({
        customer_id: acc.customer_id,
        closed_by: user?.id ?? "",
        amount_settled: Number(acc.total_paid),
        outstanding_after: Number(acc.balance),
        period_end: todayInCairo(),
      });
      if (error) throw error;
      await logAudit({
        actorId: user?.id,
        action: "close_account",
        entity: "account_closing",
        entityId: acc.customer_id,
        newValue: { outstanding_after: acc.balance },
      });
    },
    onSuccess: () => {
      setCloseFor(null);
      void qc.invalidateQueries({ queryKey: ["admin-ledger"] });
      toast.success(t("saved"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const term = q.trim().toLowerCase();
  const all = accounts.data ?? [];
  const filtered = all.filter((a) =>
    !term
      ? true
      : [a.full_name, a.display_name, a.email, a.department]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(term)),
  );
  const pending = filtered.filter((a) => a.approval_status === "pending");
  const approved = filtered.filter((a) => a.approval_status === "approved");
  const rejected = filtered.filter((a) => a.approval_status === "rejected");

  const exportAccounts = () => {
    const csv = toCsv(
      approved.map((a) => ({
        name: a.display_name ?? a.full_name ?? a.email,
        email: a.email,
        department: a.department ?? "",
        total_ordered: a.total_ordered,
        total_paid: a.total_paid,
        balance: a.balance,
      })),
      [
        { key: "name", label: t("customer") },
        { key: "email", label: t("email") },
        { key: "department", label: t("department") },
        { key: "total_ordered", label: t("totalOrders") },
        { key: "total_paid", label: t("totalPaid") },
        { key: "balance", label: t("balance") },
      ],
    );
    downloadCsv("accounts.csv", csv);
  };

  const renderList = (rows: Account[]) =>
    rows.length === 0 ? (
      <EmptyState />
    ) : (
      <div className="space-y-2">
        {rows.map((a) => (
          <Card key={a.customer_id}>
            <CardContent className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <div className="min-w-40 flex-1">
                <p className="font-semibold">{a.display_name ?? a.full_name ?? a.email}</p>
                <p className="text-xs text-muted-foreground">
                  {a.email}
                  {a.department ? ` · ${a.department}` : ""}
                </p>
              </div>
              <div className="text-xs text-muted-foreground">
                <p>
                  {t("lastOrder")}: {a.last_order_at ? formatDateTime(a.last_order_at, lang) : "—"}
                </p>
                <p>
                  {t("lastPayment")}: {a.last_payment_on ? formatDate(a.last_payment_on, lang) : "—"}
                </p>
              </div>
              <div className="text-end">
                <p className="text-xs text-muted-foreground">{t("balance")}</p>
                <p className={`font-extrabold ${Number(a.balance) < 0 ? "text-destructive" : ""}`}>
                  {money(a.balance)}
                </p>
              </div>
              {a.approval_status === "pending" ? (
                <div className="flex gap-1">
                  <Button size="sm" onClick={() => setApproval.mutate({ acc: a, status: "approved" })}>
                    <Check className="size-4" />
                    {t("approve")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setApproval.mutate({ acc: a, status: "rejected" })}
                  >
                    <X className="size-4" />
                    {t("reject")}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="outline" onClick={() => setLedgerFor(a)}>
                    {t("ledger")}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setPayFor(a);
                      setPayAmount(String(a.balance > 0 ? a.balance : ""));
                    }}
                  >
                    <Wallet className="size-4" />
                    {t("recordPayment")}
                  </Button>
                  {a.approval_status === "rejected" && (
                    <Badge variant="secondary">{t("ap_rejected")}</Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{t("customers")}</h1>
        <div className="flex items-center gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("search")}
            className="w-48 bg-card"
          />
          <Button variant="outline" onClick={exportAccounts} className="gap-1.5">
            <FileDown className="size-4" />
            {t("export")}
          </Button>
        </div>
      </div>

      {accounts.isLoading ? (
        <LoadingState />
      ) : (
        <Tabs defaultValue={pending.length > 0 ? "pending" : "approved"}>
          <TabsList>
            <TabsTrigger value="pending">
              {t("ap_pending")} {pending.length > 0 && `(${pending.length})`}
            </TabsTrigger>
            <TabsTrigger value="approved">{t("ap_approved")}</TabsTrigger>
            <TabsTrigger value="rejected">{t("ap_rejected")}</TabsTrigger>
          </TabsList>
          <TabsContent value="pending">{renderList(pending)}</TabsContent>
          <TabsContent value="approved">{renderList(approved)}</TabsContent>
          <TabsContent value="rejected">{renderList(rejected)}</TabsContent>
        </Tabs>
      )}

      {/* Ledger */}
      <Dialog open={Boolean(ledgerFor)} onOpenChange={(o) => !o && setLedgerFor(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {t("ledger")} — {ledgerFor?.display_name ?? ledgerFor?.full_name ?? ledgerFor?.email}
            </DialogTitle>
          </DialogHeader>
          {ledger.isLoading ? (
            <LoadingState />
          ) : (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted p-3 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">{t("totalOrders")}</p>
                  <p className="font-bold">{money(ledgerFor?.total_ordered)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("totalPaid")}</p>
                  <p className="font-bold">{money(ledgerFor?.total_paid)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("balance")}</p>
                  <p className="font-extrabold text-primary">{money(ledgerFor?.balance)}</p>
                </div>
              </div>

              <section>
                <h3 className="mb-1 font-semibold">{t("orders")}</h3>
                <ul className="divide-y divide-border">
                  {(ledger.data?.orders ?? []).map((o) => (
                    <li key={o.id} className="flex items-center gap-2 py-1.5">
                      <span className="font-medium">#{o.order_number}</span>
                      <span className="text-muted-foreground">{formatDateTime(o.created_at, lang)}</span>
                      <span className="ms-auto font-semibold">{money(o.total)}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="mb-1 font-semibold">{t("payments")}</h3>
                <ul className="divide-y divide-border">
                  {(ledger.data?.payments ?? []).map((p) => (
                    <li key={p.id} className="flex items-center gap-2 py-1.5">
                      <span>{formatDate(p.paid_on, lang)}</span>
                      <span className="text-muted-foreground">{p.method}</span>
                      <span className="ms-auto font-semibold text-primary">{money(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {(ledger.data?.closings ?? []).length > 0 && (
                <section>
                  <h3 className="mb-1 font-semibold">{t("closings")}</h3>
                  <ul className="divide-y divide-border">
                    {ledger.data?.closings.map((c) => (
                      <li key={c.id} className="flex items-center gap-2 py-1.5">
                        <span>{formatDate(c.period_end, lang)}</span>
                        <span className="text-muted-foreground">
                          {t("amountSettled")}: {money(c.amount_settled)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => ledgerFor && setCloseFor(ledgerFor)}>
              {t("closeAccount")}
            </Button>
            <Button onClick={() => setLedgerFor(null)}>{t("close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record payment */}
      <Dialog open={Boolean(payFor)} onOpenChange={(o) => !o && setPayFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("recordPayment")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t("amount")}</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("method")}</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{t("type_CASH")}</SelectItem>
                  <SelectItem value="transfer">{t("method")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>
                {t("notes")} <span className="text-muted-foreground">({t("optional")})</span>
              </Label>
              <Textarea rows={2} value={payNotes} onChange={(e) => setPayNotes(e.target.value)} maxLength={300} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayFor(null)}>
              {t("cancel")}
            </Button>
            <Button disabled={recordPayment.isPending} onClick={() => recordPayment.mutate()}>
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close account confirm */}
      <Dialog open={Boolean(closeFor)} onOpenChange={(o) => !o && setCloseFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("closeAccount")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("closeAccountConfirm")}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseFor(null)}>
              {t("cancel")}
            </Button>
            <Button disabled={closeAccount.isPending} onClick={() => closeFor && closeAccount.mutate(closeFor)}>
              {t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
