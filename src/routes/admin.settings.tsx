import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useSettings, settingsQueryKey, type RestaurantSettings } from "@/lib/settings";
import { useAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { uploadImageDetailed, formatBytes, useSignedUrls } from "@/lib/storage";
import { LoadingState } from "@/components/states";
import { ImageUpload } from "@/components/admin/image-upload";
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
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (settings && !form) setForm(settings);
  }, [settings, form]);

  const { data: images } = useSignedUrls("brand-assets", [form?.logo_url, form?.favicon_url, form?.hero_image_url]);

  const save = useMutation({
    mutationFn: async (s: RestaurantSettings) => {
      const { error } = await supabase
        .from("restaurant_settings")
        .update({
          name_ar: s.name_ar,
          name_en: s.name_en,
          logo_url: s.logo_url,
          hero_image_url: s.hero_image_url,
          favicon_url: s.favicon_url,
          primary_color: s.primary_color,
          accent_color: s.accent_color,
          currency_code: s.currency_code,
          currency_symbol_ar: s.currency_symbol_ar,
          currency_symbol_en: s.currency_symbol_en,
          contact_phone: s.contact_phone,
          contact_email: s.contact_email,
          address: s.address,
        })
        .eq("id", s.id);
      if (error) throw error;
      await logAudit({ actorId: user?.id, action: "update", entity: "settings", entityId: s.id, newValue: s });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: settingsQueryKey });
      toast.success(t("saved"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !form) return <LoadingState />;

  const set = <K extends keyof RestaurantSettings>(k: K, v: RestaurantSettings[K]) =>
    setForm({ ...form, [k]: v });

  const upload = async (file: File, key: "logo_url" | "favicon_url" | "hero_image_url") => {
    setUploading(true);
    try {
      const res = await uploadImageDetailed("brand-assets", file);
      setForm((prev) => (prev ? { ...prev, [key]: res.path } : prev));
      toast.success(`${t("saved")} · ${formatBytes(res.originalSize)} → ${formatBytes(res.uploadedSize)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("error"));
    } finally {
      setUploading(false);
    }
  };

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
            <Input value={form.name_ar} onChange={(e) => set("name_ar", e.target.value)} maxLength={60} />
          </Row>
          <Row label={t("nameEn")}>
            <Input value={form.name_en} onChange={(e) => set("name_en", e.target.value)} maxLength={60} />
          </Row>
          <Row label={t("contactPhone")}>
            <Input value={form.contact_phone ?? ""} onChange={(e) => set("contact_phone", e.target.value)} />
          </Row>
          <Row label={t("contactEmail")}>
            <Input value={form.contact_email ?? ""} onChange={(e) => set("contact_email", e.target.value)} />
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
            <Input type="color" value={form.primary_color} onChange={(e) => set("primary_color", e.target.value)} />
          </Row>
          <Row label={t("accentColor")}>
            <Input type="color" value={form.accent_color} onChange={(e) => set("accent_color", e.target.value)} />
          </Row>
          <div className="sm:col-span-2">
            <ImageUpload
              label={t("logo")}
              previewUrl={form.logo_url ? images?.[form.logo_url] : null}
              hasValue={Boolean(form.logo_url)}
              uploading={uploading}
              onSelect={(file) => void upload(file, "logo_url")}
              onRemove={() => set("logo_url", null)}
            />
          </div>
          <div className="sm:col-span-2">
            <ImageUpload
              label={t("heroImage")}
              hint={t("heroImageHint")}
              previewClassName="h-20 w-36"
              previewUrl={form.hero_image_url ? images?.[form.hero_image_url] : null}
              hasValue={Boolean(form.hero_image_url)}
              uploading={uploading}
              onSelect={(file) => void upload(file, "hero_image_url")}
              onRemove={() => set("hero_image_url", null)}
            />
          </div>
          <div className="sm:col-span-2">
            <ImageUpload
              label={t("favicon")}
              hint={t("faviconHint")}
              previewClassName="size-14"
              previewUrl={form.favicon_url ? images?.[form.favicon_url] : null}
              hasValue={Boolean(form.favicon_url)}
              uploading={uploading}
              onSelect={(file) => void upload(file, "favicon_url")}
              onRemove={() => set("favicon_url", null)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("currency")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Row label={t("currencyCode")}>
            <Input value={form.currency_code} onChange={(e) => set("currency_code", e.target.value)} maxLength={5} />
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
