import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useSettings, settingsQueryKey, type RestaurantSettings } from "@/lib/settings";
import { useAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettings,
});

function AdminSettings() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: settings, isLoading } = useSettings();
  const [form, setForm] = useState<RestaurantSettings | null>(null);

  useEffect(() => {
    if (settings && !form) setForm(settings);
  }, [settings, form]);

  const save = useMutation({
    mutationFn: async (s: RestaurantSettings) => {
      const { data, error } = await supabase
        .from("restaurant_settings")
        .update({
          name_ar: s.name_ar,
          name_en: s.name_en,
          logo_url: s.logo_url,
          hero_image_url: s.hero_image_url,
          primary_color: s.primary_color,
          accent_color: s.accent_color,
          currency_code: s.currency_code,
          currency_symbol_ar: s.currency_symbol_ar,
          currency_symbol_en: s.currency_symbol_en,
          contact_phone: s.contact_phone,
          contact_email: s.contact_email,
          address: s.address,
        })
        .eq("id", s.id)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      // A silent 0-row update means the write never landed (permissions/id drift).
      if (!data) throw new Error(t("error"));
      await logAudit({
        actorId: user?.id,
        action: "update",
        entity: "settings",
        entityId: s.id,
        newValue: s,
      });
      return data as unknown as RestaurantSettings;
    },
    onSuccess: (row) => {
      // Re-seed both the cache and the form from what the database actually stored.
      qc.setQueryData(settingsQueryKey, row);
      setForm(row);
      void qc.invalidateQueries({ queryKey: settingsQueryKey });
      toast.success(t("saved"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !form) return <LoadingState />;

  const set = <K extends keyof RestaurantSettings>(k: K, v: RestaurantSettings[K]) =>
    setForm({ ...form, [k]: v });

  const publicUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-2xl font-extrabold">{t("settings")}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("restaurantName")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Row label={t("nameAr")}>
            <Input
              value={form.name_ar}
              onChange={(e) => set("name_ar", e.target.value)}
              maxLength={60}
            />
          </Row>
          <Row label={t("nameEn")}>
            <Input
              value={form.name_en}
              onChange={(e) => set("name_en", e.target.value)}
              maxLength={60}
            />
          </Row>
          <Row label={t("contactPhone")}>
            <Input
              value={form.contact_phone ?? ""}
              onChange={(e) => set("contact_phone", e.target.value)}
            />
          </Row>
          <Row label={t("contactEmail")}>
            <Input
              value={form.contact_email ?? ""}
              onChange={(e) => set("contact_email", e.target.value)}
            />
          </Row>
          <Row label={t("address")}>
            <Input value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} />
          </Row>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("brandColors")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Row label={t("primaryColor")}>
            <Input
              type="color"
              value={form.primary_color}
              onChange={(e) => set("primary_color", e.target.value)}
            />
          </Row>
          <Row label={t("accentColor")}>
            <Input
              type="color"
              value={form.accent_color}
              onChange={(e) => set("accent_color", e.target.value)}
            />
          </Row>
          <div className="sm:col-span-2 space-y-2 rounded-xl border border-dashed border-border bg-muted/30 p-4 opacity-70">
            <p className="text-sm font-semibold">
              {t("logo")} · {t("heroImage")}
            </p>
            <p className="text-xs text-muted-foreground">
              يتم تغييرها عبر المطور (ملفات ثابتة داخل الموقع) — Changed via the developer (static
              files).
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("currency")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Row label={t("currencyCode")}>
            <Input
              value={form.currency_code}
              onChange={(e) => set("currency_code", e.target.value)}
              maxLength={5}
            />
          </Row>
          <Row label={t("currencySymbolAr")}>
            <Input
              value={form.currency_symbol_ar}
              onChange={(e) => set("currency_symbol_ar", e.target.value)}
              maxLength={8}
            />
          </Row>
          <Row label={t("currencySymbolEn")}>
            <Input
              value={form.currency_symbol_en}
              onChange={(e) => set("currency_symbol_en", e.target.value)}
              maxLength={8}
            />
          </Row>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("publicLink")}</CardTitle>
        </CardHeader>
        <CardContent>
          <code className="break-all text-sm text-muted-foreground" dir="ltr">
            {publicUrl}/
          </code>
        </CardContent>
      </Card>

      <Button disabled={save.isPending} onClick={() => save.mutate(form)}>
        {t("save")}
      </Button>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
