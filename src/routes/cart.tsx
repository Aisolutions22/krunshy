import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Minus, Plus, Trash2, Wallet, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, pickName } from "@/lib/i18n";
import { useMoney } from "@/lib/settings";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { addGuestOrder } from "@/lib/guest-orders";

import { useSignedUrls } from "@/lib/storage";
import { SiteHeader } from "@/components/site-header";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your cart — Crunchy" },
      { name: "description", content: "Review your Crunchy order and check out as a visitor or on account." },
      { property: "og:title", content: "Your cart — Crunchy" },
      { property: "og:description", content: "Review your Crunchy order and check out." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { t, lang } = useI18n();
  const money = useMoney();
  const cart = useCart();
  const { user, isApproved, profile } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<"CASH" | "ACCOUNT">("CASH");
  const [visitorName, setVisitorName] = useState("");
  const [visitorPhone, setVisitorPhone] = useState("");
  const [notes, setNotes] = useState("");

  const { data: images } = useSignedUrls(
    "menu-images",
    cart.lines.map((l) => l.image),
  );

  const canOrderOnAccount = Boolean(user && isApproved);
  const effectiveMode = canOrderOnAccount ? mode : "CASH";

  const place = useMutation({
    mutationFn: async () => {
      const token = crypto.randomUUID();
      const name = effectiveMode === "CASH" ? visitorName : (profile?.display_name ?? "");
      const { error } = await supabase.rpc("create_order", {
        _items: cart.lines.map((l) => ({ product_id: l.productId, quantity: l.quantity })),
        _order_type: effectiveMode,
        _visitor_name: name,
        _visitor_phone: effectiveMode === "CASH" ? visitorPhone : "",
        _notes: notes,
        _client_token: token,
        _language: lang,
      });

      if (error) throw error;
      const { data: num } = await supabase.rpc("order_number_by_token", { _client_token: token });
      return { token, order_number: typeof num === "number" ? num : null };
    },
    onSuccess: ({ token, order_number }) => {
      cart.clear();
      addGuestOrder({ token, order_number, created_at: new Date().toISOString() });
      void navigate({ to: "/track/$token", params: { token }, replace: true });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : t("error"));
    },
  });

  const empty = cart.lines.length === 0;

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      <SiteHeader />

      {empty ? (
        <main className="flex flex-1 items-center justify-center px-4">
          <EmptyState
            title={t("emptyCart")}
            hint={t("emptyCartHint")}
            action={
              <Button asChild className="mt-2">
                <Link to="/">{t("browseMenu")}</Link>
              </Button>
            }
          />
        </main>
      ) : (
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-hidden px-3 sm:px-4">
          {/* Middle: only scrollable region */}
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-3">
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {cart.lines.map((l) => {
                const img = l.image ? images?.[l.image] : undefined;
                return (
                  <li
                    key={l.productId}
                    className="grid h-16 grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 px-3"
                  >
                    {img ? (
                      <img src={img} alt="" className="size-10 rounded-lg object-cover" />
                    ) : (
                      <div className="size-10 rounded-lg bg-muted" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {pickName(lang, l.nameAr, l.nameEn)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {money(l.price)} × {l.quantity} = {money(l.price * l.quantity)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        className="size-9"
                        onClick={() => cart.setQty(l.productId, l.quantity - 1)}
                        aria-label={t("decreaseQty")}
                      >
                        <Minus className="size-4" />
                      </Button>
                      <span className="w-6 text-center text-sm font-bold">{l.quantity}</span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="size-9"
                        onClick={() => cart.setQty(l.productId, l.quantity + 1)}
                        aria-label={t("increaseQty")}
                      >
                        <Plus className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-9 text-destructive"
                        onClick={() => cart.remove(l.productId)}
                        aria-label={t("removeItem")}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="space-y-3 rounded-xl border border-border bg-card p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setMode("CASH")}
                  className={`flex items-center gap-2 rounded-lg border p-2.5 text-start transition ${
                    effectiveMode === "CASH" ? "border-primary bg-accent/50" : "border-border"
                  }`}
                >
                  <Wallet className="size-4 shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{t("orderAsVisitor")}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {t("payNowCash")}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  disabled={!canOrderOnAccount}
                  onClick={() => setMode("ACCOUNT")}
                  className={`flex items-center gap-2 rounded-lg border p-2.5 text-start transition disabled:opacity-50 ${
                    effectiveMode === "ACCOUNT" ? "border-primary bg-accent/50" : "border-border"
                  }`}
                >
                  <CreditCard className="size-4 shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{t("orderOnAccount")}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {canOrderOnAccount
                        ? t("payLater")
                        : user
                          ? t("pendingApproval")
                          : t("createAccountRequest")}
                    </span>
                  </span>
                </button>
              </div>

              {effectiveMode === "CASH" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="vname" className="text-xs">
                      {t("visitorName")}
                    </Label>
                    <Input
                      id="vname"
                      value={visitorName}
                      maxLength={80}
                      onChange={(e) => setVisitorName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="vphone" className="text-xs">
                      {t("visitorPhone")}{" "}
                      <span className="text-muted-foreground">({t("optional")})</span>
                    </Label>
                    <Input
                      id="vphone"
                      value={visitorPhone}
                      maxLength={20}
                      inputMode="tel"
                      onChange={(e) => setVisitorPhone(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="notes" className="text-xs">
                  {t("notes")} <span className="text-muted-foreground">({t("optional")})</span>
                </Label>
                <Textarea
                  id="notes"
                  value={notes}
                  maxLength={500}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>

              {!user && (
                <button
                  type="button"
                  className="w-full text-center text-xs text-primary underline-offset-4 hover:underline"
                  onClick={() => void navigate({ to: "/auth" })}
                >
                  {t("createAccountRequest")}
                </button>
              )}
            </div>
          </div>

          {/* Bottom: always visible */}
          <div className="shrink-0 border-t border-border bg-background/95 py-3 backdrop-blur">
            <div className="mb-2 flex items-center justify-between text-base font-bold">
              <span>{t("total")}</span>
              <span className="text-primary">{money(cart.total)}</span>
            </div>
            <Button
              className="h-11 w-full"
              disabled={place.isPending || (effectiveMode === "CASH" && visitorName.trim().length < 2)}
              onClick={() => place.mutate()}
            >
              {place.isPending ? t("loading") : t("placeOrder")}
            </Button>
          </div>
        </main>
      )}
    </div>
  );
}
