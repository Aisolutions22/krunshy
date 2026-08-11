import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { BrandMark, LanguageToggle } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Krunshy" },
      { name: "description", content: "Sign in to your Krunshy account or request a company ordering account." },
      { property: "og:title", content: "Sign in — Krunshy" },
      { property: "og:description", content: "Sign in or request a Krunshy account." },
    ],
  }),
  component: AuthPage,
});

const signInSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(72),
});

const signUpSchema = signInSchema.extend({
  password: z.string().min(6).max(72),
  fullName: z.string().trim().min(2).max(100),
  department: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(20).optional(),
});

function AuthPage() {
  const { t } = useI18n();
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [form, setForm] = useState({ email: "", password: "", fullName: "", department: "", phone: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) void navigate({ to: isAdmin ? "/admin" : "/account", replace: true });
  }, [loading, user, isAdmin, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed =
      mode === "signin"
        ? signInSchema.safeParse({ email: form.email, password: form.password })
        : signUpSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? t("error"));
      return;
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email.trim(),
          password: form.password,
        });
        if (error) throw error;
      } else {
        if (form.fullName.trim().length < 2) {
          toast.error(t("fullName"));
          return;
        }
        const { error } = await supabase.auth.signUp({
          email: form.email.trim(),
          password: form.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: form.fullName.trim(),
              display_name: form.fullName.trim(),
              department: form.department.trim(),
              phone: form.phone.trim(),
            },
          },
        });
        if (error) throw error;
        toast.success(t("pendingApproval"));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-accent/50 to-background">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
        <BrandMark />
        <LanguageToggle />
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pb-16">
        <Card>
          <CardContent className="p-6">
            <h1 className="text-xl font-extrabold">{mode === "signin" ? t("signIn") : t("createAccountRequest")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "signin" ? t("appTagline") : t("pendingApprovalHint")}
            </p>

            <form onSubmit={submit} className="mt-5 space-y-3">
              {mode === "signup" && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="fullName">{t("fullName")}</Label>
                    <Input
                      id="fullName"
                      value={form.fullName}
                      onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                      required
                      maxLength={100}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="department">{t("department")}</Label>
                      <Input
                        id="department"
                        value={form.department}
                        onChange={(e) => setForm({ ...form, department: e.target.value })}
                        maxLength={100}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="phone">{t("visitorPhone")}</Label>
                      <Input
                        id="phone"
                        value={form.phone}
                        inputMode="tel"
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        maxLength={20}
                      />
                    </div>
                  </div>
                </>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">{t("email")}</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  maxLength={255}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">{t("password")}</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  minLength={6}
                  maxLength={72}
                />
              </div>
              <Button type="submit" className="h-11 w-full" disabled={busy}>
                {busy ? t("loading") : mode === "signin" ? t("signIn") : t("signUp")}
              </Button>
            </form>

            <button
              type="button"
              className="mt-4 w-full text-center text-sm text-primary underline-offset-4 hover:underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? t("noAccount") : t("haveAccount")}
            </button>
          </CardContent>
        </Card>

        <Button asChild variant="ghost" className="mx-auto mt-4">
          <Link to="/">{t("browseMenu")}</Link>
        </Button>
      </main>
    </div>
  );
}
