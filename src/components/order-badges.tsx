import { useI18n, dict } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";

export type OrderStatus = "pending" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled";

const tone: Record<OrderStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  confirmed: "bg-accent text-accent-foreground",
  preparing: "bg-warning/20 text-warning-foreground",
  ready: "bg-primary/15 text-primary",
  completed: "bg-success/15 text-success",
  cancelled: "bg-destructive/15 text-destructive",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useI18n();
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone[status]}`}>
      {t(`st_${status}` as keyof typeof dict)}
    </span>
  );
}

export function PaymentBadge({ status }: { status: "paid" | "unpaid" }) {
  const { t } = useI18n();
  return (
    <Badge variant={status === "paid" ? "default" : "secondary"} className="text-xs">
      {status === "paid" ? t("paid") : t("unpaid")}
    </Badge>
  );
}

export function OrderTypeBadge({ type }: { type: "ACCOUNT" | "CASH" }) {
  const { t } = useI18n();
  return (
    <Badge variant="outline" className="text-xs">
      {t(`type_${type}` as keyof typeof dict)}
    </Badge>
  );
}
