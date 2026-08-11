import type { ReactNode } from "react";
import { Loader2, Inbox, AlertTriangle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export function LoadingState({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      {label ?? t("loading")}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title?: string; hint?: string; action?: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/50 py-14 text-center">
      <Inbox className="size-6 text-muted-foreground" />
      <p className="font-medium">{title ?? t("noData")}</p>
      {hint && <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 py-12 text-center">
      <AlertTriangle className="size-6 text-destructive" />
      <p className="text-sm font-medium">{t("error")}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t("retry")}
        </Button>
      )}
    </div>
  );
}
