import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { formatDateTime } from "@/lib/dates";
import { getSheetsSyncHealth, retrySyncRecord, resyncAll } from "@/lib/sheets.functions";
import { LoadingState, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/admin/integrations")({
  component: AdminIntegrations,
});

type SyncLog = {
  id: string;
  table_name: string;
  record_id: string | null;
  status: string;
  error_message: string | null;
  attempted_at: string;
  retry_count: number;
};

function AdminIntegrations() {
  const navigateGuard = useNavigate();
  const { isAdmin: guardIsAdmin, isSalesStaff: guardIsSalesStaff, loading: guardLoading } = useAuth();
  useEffect(() => {
    if (!guardLoading && guardIsSalesStaff && !guardIsAdmin) void navigateGuard({ to: "/admin/orders", replace: true });
  }, [guardLoading, guardIsSalesStaff, guardIsAdmin, navigateGuard]);
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const health = useServerFn(getSheetsSyncHealth);
  const retry = useServerFn(retrySyncRecord);
  const rebuild = useServerFn(resyncAll);

  const healthQuery = useQuery({
    queryKey: ["sheets-health"],
    queryFn: () => health(),
  });

  const logs = useQuery({
    queryKey: ["sync_logs"],
    queryFn: async (): Promise<SyncLog[]> => {
      const { data, error } = await supabase
        .from("sync_logs")
        .select("*")
        .order("attempted_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as SyncLog[];
    },
    refetchInterval: 30_000,
  });

  const retryOne = useMutation({
    mutationFn: async (log: SyncLog) =>
      retry({ data: { table: log.table_name as never, recordId: log.record_id ?? "" } }),
    onSuccess: (res) => {
      if (res.ok) toast.success(t("syncSucceeded"));
      else toast.error(res.error ?? t("error"));
      void qc.invalidateQueries({ queryKey: ["sync_logs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rebuildAll = useMutation({
    mutationFn: async () => rebuild(),
    onSuccess: (res) => {
      toast.success(`${t("syncSucceeded")}: ${res.synced} · ${t("failed")}: ${res.failed}`);
      void qc.invalidateQueries({ queryKey: ["sync_logs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const configured =
    healthQuery.data?.hasServiceAccount && healthQuery.data?.hasSpreadsheetId;
  const failedLogs = (logs.data ?? []).filter((l) => l.status !== "success");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold">{t("integrations")}</h1>
        <Button
          className="ms-auto gap-1.5"
          disabled={!configured || rebuildAll.isPending}
          onClick={() => rebuildAll.mutate()}
        >
          <RefreshCw className={`size-4 ${rebuildAll.isPending ? "animate-spin" : ""}`} />
          {t("resyncAll")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("googleSheetsSync")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <StatusLine
            ok={Boolean(healthQuery.data?.hasServiceAccount)}
            label={t("serviceAccountKey")}
          />
          <StatusLine
            ok={Boolean(healthQuery.data?.hasSpreadsheetId)}
            label={t("spreadsheetId")}
          />
          <p className="pt-1 text-muted-foreground">{t("syncHint")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("failedSyncs")} {failedLogs.length > 0 && <Badge variant="destructive">{failedLogs.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.isLoading ? (
            <LoadingState />
          ) : failedLogs.length === 0 ? (
            <EmptyState title={t("allSynced")} />
          ) : (
            <div className="space-y-2">
              {failedLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3 text-sm"
                >
                  <span className="font-semibold">{log.table_name}</span>
                  <span className="text-xs text-muted-foreground" dir="ltr">
                    {log.record_id?.slice(0, 8)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(log.attempted_at, lang)}
                  </span>
                  <span className="w-full text-xs text-destructive sm:w-auto sm:flex-1" dir="ltr">
                    {log.error_message}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={retryOne.isPending}
                    onClick={() => retryOne.mutate(log)}
                  >
                    {t("retry")}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("recentSyncs")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          {(logs.data ?? []).slice(0, 25).map((log) => (
            <div key={log.id} className="flex items-center gap-2">
              {log.status === "success" ? (
                <CheckCircle2 className="size-4 text-primary" />
              ) : (
                <AlertTriangle className="size-4 text-destructive" />
              )}
              <span className="font-medium">{log.table_name}</span>
              <span className="ms-auto text-xs text-muted-foreground">
                {formatDateTime(log.attempted_at, lang)}
              </span>
            </div>
          ))}
          {(logs.data ?? []).length === 0 && !logs.isLoading && <EmptyState title={t("noData")} />}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusLine({ ok, label }: { ok: boolean; label: string }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-2">
      {ok ? (
        <CheckCircle2 className="size-4 text-primary" />
      ) : (
        <AlertTriangle className="size-4 text-destructive" />
      )}
      <span>{label}</span>
      <Badge variant={ok ? "secondary" : "destructive"} className="ms-auto">
        {ok ? t("configured") : t("missing")}
      </Badge>
    </div>
  );
}
