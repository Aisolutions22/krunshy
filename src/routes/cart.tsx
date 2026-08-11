import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Minus, Plus, Trash2, CheckCircle2, Wallet, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, pickName } from "@/lib/i18n";
import { useMoney } from "@/lib/settings";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { useSignedUrls } from "@/lib/storage";
import { SiteHeader } from "@/components/site-header";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your cart — Krunshy" },
      { name: "description", content: "Review your Krunshy order and check out as a visitor or on account." },
      { property: "og:title", content: "Your cart — Krunshy" },
      { property: "og:description", content: "Review your Krunshy order and check out." },
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
  const [placed, setPlaced] = useState<{ number: number | null } | null>(null);

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
      });

      if (error) throw error;
      const { data: num } = await supabase.rpc("order_number_by_token", { _client_token: token });
      return (num as number | null) ?? null;
    },
    onSuccess: (number) => {
      cart.clear();
      setPlaced({ number });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : t("error"));
    },
  });

  if (placed) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-20 text-center">
          <CheckCircle2 className="size-14 text-success" />
          <h1 className="text-2xl font-extrabold">{t("orderPlaced")}</h1>
          {placed.number !== null && (
            <p className="text-lg font-bold text-primary">
              {t("orderNumber")} {placed.number}
            </p>
          )}
          <p className="text-sm text-muted-foreground">{t("orderPlacedHint")}</p>
          <div className="mt-4 flex gap-2">
            <Button asChild>
              <Link to="/">{t("browseMenu")}</Link>
            </Button>
            {user && (
              <Button asChild variant="outline">
                <Link to="/account">{t("myAccount")}</Link>
              </Button>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-extrabold">{t("cart")}</h1>

        {cart.lines.length === 0 ? (
          <EmptyState
            title={t("emptyCart")}
            hint={t("emptyCartHint")}
            action={
              <Button asChild className="mt-2">
                <Link to="/">{t("browseMenu")}</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-6">
            <Card>
              <CardContent className="divide-y divide-border p-0">
                {cart.lines.map((l) => {
                  const img = l.image ? images?.[l.image] : undefined;
                  return (
                    <div key={l.productId} className="flex items-center gap-3 p-4">
                      {img ? (
                        <img src={img} alt="" className="size-14 rounded-lg object-cover" />
                      ) : (
                        <div className="size-14 rounded-lg bg-muted" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{pickName(lang, l.nameAr, l.nameEn)}</p>
                        <p className="text-sm text-muted-foreground">{money(l.price)}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="outline"
                          className="size-8"
                          onClick={() => cart.setQty(l.productId, l.quantity - 1)}
                          aria-label="-"
                        >
                          <Minus className="size-3.5" />
                        </Button>
                        <span className="w-8 text-center text-sm font-semibold">{l.quantity}</span>
                        <Button
                          size="icon"
                          variant="outline"
                          className="size-8"
                          onClick={() => cart.setQty(l.productId, l.quantity + 1)}
                          aria-label="+"
                        >
                          <Plus className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-destructive"
                          onClick={() => cart.remove(l.productId)}
                          aria-label={t("cancel")}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                      <div className="w-24 text-end font-semibold">{money(l.price * l.quantity)}</div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 p-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setMode("CASH")}
                    className={`flex items-start gap-3 rounded-lg border p-3 text-start transition ${
                      effectiveMode === "CASH" ? "border-primary bg-accent/50" : "border-border"
                    }`}
                  >
                    <Wallet className="mt-0.5 size-5 text-primary" />
                    <span>
                      <span className="block font-semibold">{t("orderAsVisitor")}</span>
                      <span className="block text-xs text-muted-foreground">{t("payNowCash")}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={!canOrderOnAccount}
                    onClick={() => setMode("ACCOUNT")}
                    className={`flex items-start gap-3 rounded-lg border p-3 text-start transition disabled:opacity-50 ${
                      effectiveMode === "ACCOUNT" ? "border-primary bg-accent/50" : "border-border"
                    }`}
                  >
                    <CreditCard className="mt-0.5 size-5 text-primary" />
                    <span>
                      <span className="block font-semibold">{t("orderOnAccount")}</span>
                      <span className="block text-xs text-muted-foreground">
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
                    <div className="space-y-1.5">
                      <Label htmlFor="vname">{t("visitorName")}</Label>
                      <Input
                        id="vname"
                        value={visitorName}
                        maxLength={80}
                        onChange={(e) => setVisitorName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="vphone">
                        {t("visitorPhone")}{" "}
                        <span className="text-xs text-muted-foreground">({t("optional")})</span>
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

                <div className="space-y-1.5">
                  <Label htmlFor="notes">
                    {t("notes")} <span className="text-xs text-muted-foreground">({t("optional")})</span>
                  </Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    maxLength={500}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                  />
                </div>

                <div className="flex items-center justify-between border-t border-border pt-4 text-lg font-bold">
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

                {!user && (
                  <button
                    type="button"
                    className="w-full text-center text-sm text-primary underline-offset-4 hover:underline"
                    onClick={() => void navigate({ to: "/auth" })}
                  >
                    {t("createAccountRequest")}
                  </button>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
