import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { BellOff, BellRing, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useMoney } from "@/lib/settings";
import { Button } from "@/components/ui/button";

const SOUND_URL = "/sounds/new-order.mp3";
const SESSION_KEY = "krunshy_order_sound_unlocked";
const MUTED_KEY = "krunshy_order_sound_muted";

export type OrderAlert = {
  id: string;
  orderNumber: number;
  orderType: "ACCOUNT" | "CASH";
  total: number;
  name: string;
  at: number;
};

type Ctx = {
  alerts: OrderAlert[];
  unseenCount: number;
  muted: boolean;
  toggleMuted: () => void;
  dismiss: (id: string) => void;
  dismissAll: () => void;
};

const OrderAlertsContext = createContext<Ctx | null>(null);

export function OrderAlertsProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<OrderAlert[]>([]);
  const [muted, setMuted] = useState(false);
  const unlockedRef = useRef(false);
  const mutedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Durable badge: how many orders are still pending (survives reloads/navigation).
  const pending = useQuery({
    queryKey: ["admin-pending-count"],
    enabled: isAdmin,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) throw error;
      return count ?? 0;
    },
  });
  const unseenCount = isAdmin ? (pending.data ?? 0) : 0;

  useEffect(() => {
    if (typeof window === "undefined") return;
    audioRef.current = new Audio(SOUND_URL);
    audioRef.current.preload = "auto";
    unlockedRef.current = sessionStorage.getItem(SESSION_KEY) === "1";
    const stored = localStorage.getItem(MUTED_KEY) === "1";
    mutedRef.current = stored;
    setMuted(stored);
  }, []);


  const unlockAudio = useCallback(() => {
    if (unlockedRef.current) return;
    const audio = audioRef.current ?? new Audio(SOUND_URL);
    audioRef.current = audio;
    const prev = audio.volume;
    audio.volume = 0;
    void audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
      })
      .catch(() => undefined)
      .finally(() => {
        audio.volume = prev || 1;
        unlockedRef.current = true;
        sessionStorage.setItem(SESSION_KEY, "1");
      });
  }, []);

  const toggleMuted = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      mutedRef.current = next;
      localStorage.setItem(MUTED_KEY, next ? "1" : "0");
      if (!next) unlockAudio();
      return next;
    });
  }, [unlockAudio]);

  // Keep the pending badge fresh when the admin lands on the orders page.
  useEffect(() => {
    if (pathname.startsWith("/admin/orders")) {
      void qc.invalidateQueries({ queryKey: ["admin-pending-count"] });
    }
  }, [pathname, qc]);

  useEffect(() => {
    if (!isAdmin) return;
    const seen = new Set<string>();
    const channel = supabase
      .channel("admin-new-orders")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const row = payload.new as {
            id: string;
            order_number: number;
            order_type: "ACCOUNT" | "CASH";
            total: number | string;
            visitor_name: string | null;
          };
          if (!row?.id || seen.has(row.id)) return;
          seen.add(row.id);

          setAlerts((prev) =>
            [
              {
                id: row.id,
                orderNumber: row.order_number,
                orderType: row.order_type,
                total: Number(row.total ?? 0),
                name: row.visitor_name ?? "",
                at: Date.now(),
              },
              ...prev,
            ].slice(0, 6),
          );

          const audio = audioRef.current;
          if (audio && !mutedRef.current) {
            audio.currentTime = 0;
            void audio.play().catch(() => undefined);
          }

          void qc.invalidateQueries({ queryKey: ["admin-pending-count"] });
          void qc.invalidateQueries({ queryKey: ["notifications", "admin"] });
          void qc.invalidateQueries({ queryKey: ["admin-orders"] });
          void qc.invalidateQueries({ queryKey: ["admin-overview"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        () => void qc.invalidateQueries({ queryKey: ["admin-pending-count"] }),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc, isAdmin]);


  const dismiss = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);
  const dismissAll = useCallback(() => setAlerts([]), []);

  const value = useMemo<Ctx>(
    () => ({ alerts, unseenCount, muted, toggleMuted, dismiss, dismissAll }),
    [alerts, unseenCount, muted, toggleMuted, dismiss, dismissAll],
  );

  return <OrderAlertsContext.Provider value={value}>{children}</OrderAlertsContext.Provider>;
}

export function useOrderAlerts() {
  const ctx = useContext(OrderAlertsContext);
  if (!ctx) throw new Error("useOrderAlerts must be used inside OrderAlertsProvider");
  return ctx;
}

export function SoundToggle() {
  const { muted, toggleMuted } = useOrderAlerts();
  const { t } = useI18n();
  const label = muted ? t("unmuteAlerts") : t("muteAlerts");
  return (
    <Button
      variant={muted ? "ghost" : "outline"}
      size="sm"
      className="gap-1.5"
      onClick={toggleMuted}
      aria-pressed={!muted}
      aria-label={label}
      title={label}
    >
      {muted ? (
        <BellOff className="size-4 text-muted-foreground" />
      ) : (
        <BellRing className="size-4 text-primary" />
      )}
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}

export function OrderAlertStack() {
  const { alerts, dismiss, dismissAll } = useOrderAlerts();
  const { t } = useI18n();
  const money = useMoney();
  const navigate = useNavigate();

  if (alerts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 end-4 z-[60] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
      {alerts.length > 1 && (
        <button
          className="pointer-events-auto self-end rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/70"
          onClick={dismissAll}
        >
          {t("dismissAll")}
        </button>
      )}
      {alerts.map((a) => (
        <div
          key={a.id}
          className="pointer-events-auto animate-in slide-in-from-bottom-2 rounded-xl border-2 border-primary bg-card p-3 shadow-lg"
        >
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <BellRing className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold">
                {t("newOrderAlert")} #{a.orderNumber}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {t(`type_${a.orderType}`)} · {money(a.total)}
                {a.name ? ` · ${a.name}` : ""}
              </p>
            </div>
            <button
              aria-label={t("close")}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted"
              onClick={() => dismiss(a.id)}
            >
              <X className="size-4" />
            </button>
          </div>
          <Button
            size="sm"
            className="mt-2 w-full"
            onClick={() => {
              dismiss(a.id);
              void navigate({ to: "/admin/orders", search: { order: a.id } });
            }}
          >
            {t("viewOrder")}
          </Button>
        </div>
      ))}
    </div>
  );
}
