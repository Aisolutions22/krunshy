import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type NotificationRow = {
  id: string;
  title_ar: string;
  title_en: string;
  message_ar: string;
  message_en: string;
  is_read: boolean;
  created_at: string;
};

export function NotificationsBell({ audience }: { audience: "admin" | "customer" }) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const key = ["notifications", audience, user?.id ?? "anon"];

  const list = useQuery({
    queryKey: key,
    enabled: Boolean(user),
    queryFn: async (): Promise<NotificationRow[]> => {
      let query = supabase
        .from("notifications")
        .select("id,title_ar,title_en,message_ar,message_en,is_read,created_at")
        .eq("recipient_role", audience)
        .order("created_at", { ascending: false })
        .limit(30);
      if (audience === "customer") query = query.eq("recipient_id", user!.id);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications-${audience}-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        () => void qc.invalidateQueries({ queryKey: key }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, audience]);

  const rows = list.data ?? [];
  const unread = rows.filter((r) => !r.is_read).length;

  async function markAllRead() {
    const ids = rows.filter((r) => !r.is_read).map((r) => r.id);
    if (ids.length === 0) return;
    await supabase.from("notifications").update({ is_read: true }).in("id", ids);
    void qc.invalidateQueries({ queryKey: key });
  }

  if (!user) return null;

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) void markAllRead();
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative" aria-label={t("notifications")}>
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute -end-0.5 -top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-96 w-80 overflow-y-auto p-0">
        <div className="border-b border-border px-3 py-2 text-sm font-bold">{t("notifications")}</div>
        {rows.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">{t("noNotifications")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((n) => (
              <li key={n.id} className={`px-3 py-2 ${n.is_read ? "" : "bg-muted/50"}`}>
                <p className="text-sm font-semibold">{lang === "ar" ? n.title_ar : n.title_en}</p>
                <p className="whitespace-pre-line text-sm text-muted-foreground">
                  {lang === "ar" ? n.message_ar : n.message_en}
                </p>

                <p className="mt-0.5 text-[11px] text-muted-foreground">{formatDateTime(n.created_at, lang)}</p>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
