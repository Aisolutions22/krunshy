import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Archive, ArchiveRestore, ImagePlus, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, pickName } from "@/lib/i18n";
import { searchTokens, matchesTokens } from "@/lib/search";
import { useMoney } from "@/lib/settings";
import { useAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { uploadImageDetailed, formatBytes, useSignedUrls } from "@/lib/storage";
import { LoadingState, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/menu")({
  component: AdminMenu,
});

type Category = { id: string; name_ar: string; name_en: string; sort_order: number; is_active: boolean };
type Product = {
  id: string;
  category_id: string | null;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  image_url: string | null;
  price: number;
  is_available: boolean;
  is_archived: boolean;
  sort_order: number;
};

const emptyProduct = {
  id: "",
  category_id: "",
  name_ar: "",
  name_en: "",
  description_ar: "",
  description_en: "",
  image_url: null as string | null,
  price: "",
  is_available: true,
  sort_order: 0,
};

// Server-side unique indexes (categories.sort_order, products(category_id, sort_order))
// surface as Postgres 23505 — turn that into a clear message instead of raw SQL text.
function orderError(err: unknown, scope: "category" | "product", lang: string): Error {
  const e = err as { code?: string; message?: string };
  if (e?.code === "23505" && (e.message ?? "").includes("sort_order")) {
    return new Error(
      lang === "en"
        ? scope === "category"
          ? "This order number is already used by another category. Choose a different number."
          : "This order number is already used by another product in the same category. Choose a different number."
        : scope === "category"
          ? "رقم الترتيب ده مستخدم بالفعل في قسم تاني. اختر رقم مختلف."
          : "رقم الترتيب ده مستخدم بالفعل في منتج تاني بنفس القسم. اختر رقم مختلف.",
    );
  }
  return err instanceof Error ? err : new Error(String(e?.message ?? err));
}

function AdminMenu() {
  const navigateGuard = useNavigate();
  const { isAdmin: guardIsAdmin, allowedPages: guardPages, loading: guardLoading } = useAuth();
  useEffect(() => {
    if (!guardLoading && !guardIsAdmin && !guardPages.includes("menu"))
      void navigateGuard({ to: "/admin/orders", replace: true });
  }, [guardLoading, guardPages, guardIsAdmin, navigateGuard]);
  const { t, lang } = useI18n();
  const money = useMoney();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [showArchived, setShowArchived] = useState(false);
  const [query, setQuery] = useState("");
  const [productDialog, setProductDialog] = useState<typeof emptyProduct | null>(null);
  const [categoryDialog, setCategoryDialog] = useState<Partial<Category> | null>(null);
  const [uploading, setUploading] = useState(false);

  const data = useQuery({
    queryKey: ["admin-menu"],
    queryFn: async () => {
      const [cats, prods] = await Promise.all([
        supabase.from("categories").select("*").order("sort_order").order("created_at"),
        supabase.from("products").select("*").order("sort_order").order("created_at"),
      ]);
      if (cats.error) throw cats.error;
      if (prods.error) throw prods.error;
      return { categories: (cats.data ?? []) as Category[], products: (prods.data ?? []) as Product[] };
    },
  });

  const paths = useMemo(() => data.data?.products.map((p) => p.image_url) ?? [], [data.data]);
  const { data: images } = useSignedUrls("menu-images", paths);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["admin-menu"] });
    void qc.invalidateQueries({ queryKey: ["public-menu"] });
  };

  const saveCategory = useMutation({
    mutationFn: async (c: Partial<Category>) => {
      if (c.id) {
        const { error } = await supabase
          .from("categories")
          .update({
            name_ar: c.name_ar ?? "",
            name_en: c.name_en ?? "",
            sort_order: c.sort_order ?? 0,
            is_active: c.is_active ?? true,
          })
          .eq("id", c.id);
        if (error) throw orderError(error, "category", lang);
      } else {
        const { error } = await supabase.from("categories").insert({
          name_ar: c.name_ar ?? "",
          name_en: c.name_en ?? "",
          sort_order: c.sort_order ?? 0,
          is_active: c.is_active ?? true,
        });
        if (error) throw orderError(error, "category", lang);
      }
      await logAudit({
        actorId: user?.id,
        action: c.id ? "update" : "create",
        entity: "category",
        entityId: c.id ?? null,
        newValue: c,
      });
    },
    onSuccess: () => {
      setCategoryDialog(null);
      invalidate();
      toast.success(t("saved"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveProduct = useMutation({
    mutationFn: async (p: typeof emptyProduct) => {
      const payload = {
        category_id: p.category_id || null,
        name_ar: p.name_ar.trim(),
        name_en: p.name_en.trim(),
        description_ar: p.description_ar.trim() || null,
        description_en: p.description_en.trim() || null,
        image_url: p.image_url,
        price: Number(p.price),
        is_available: p.is_available,
        sort_order: Number(p.sort_order) || 0,
      };
      if (!payload.name_ar || !Number.isFinite(payload.price) || payload.price < 0) {
        throw new Error(t("error"));
      }
      if (p.id) {
        const { error } = await supabase.from("products").update(payload).eq("id", p.id);
        if (error) throw orderError(error, "product", lang);
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw orderError(error, "product", lang);
      }
      await logAudit({
        actorId: user?.id,
        action: p.id ? "update" : "create",
        entity: "product",
        entityId: p.id || null,
        newValue: payload,
      });
    },
    onSuccess: () => {
      setProductDialog(null);
      invalidate();
      toast.success(t("saved"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleArchive = useMutation({
    mutationFn: async (p: Product) => {
      const { error } = await supabase
        .from("products")
        .update({ is_archived: !p.is_archived })
        .eq("id", p.id);
      if (error) throw error;
      await logAudit({
        actorId: user?.id,
        action: p.is_archived ? "unarchive" : "archive",
        entity: "product",
        entityId: p.id,
        previousValue: { is_archived: p.is_archived },
        newValue: { is_archived: !p.is_archived },
      });
    },
    onSuccess: () => {
      invalidate();
      toast.success(t("saved"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Same bilingual token matching used by the customer menu (src/lib/search.ts),
  // applied live to the freshly fetched rows — new products are searchable immediately.
  const tokens = searchTokens(query);
  const catById = useMemo(
    () => new Map((data.data?.categories ?? []).map((c) => [c.id, c])),
    [data.data],
  );

  const products = (data.data?.products ?? [])
    .filter((p) => p.is_archived === showArchived)
    .filter((p) => {
      const c = p.category_id ? catById.get(p.category_id) : undefined;
      return matchesTokens(tokens, p.name_ar, p.name_en, c?.name_ar, c?.name_en);
    });

  const categories = (data.data?.categories ?? []).filter((c) =>
    matchesTokens(tokens, c.name_ar, c.name_en),
  );

  // Display-only grouping: products clustered under their category, with categories
  // ordered by sort_order ascending and products within each group by sort_order.
  // The "X-Y" label is computed here from the two existing sort_order values —
  // never stored, never synced, never used for sorting/filtering logic.
  const groupedProducts = useMemo(() => {
    const byCat = new Map<string | null, Product[]>();
    for (const p of products) {
      const key = p.category_id ?? null;
      const arr = byCat.get(key) ?? [];
      arr.push(p);
      byCat.set(key, arr);
    }
    // Categorized groups in category sort_order (query already orders categories by
    // sort_order then created_at, so preserve that order); products already sorted by
    // sort_order from the query and preserved through filtering, but sort defensively per group.
    const sortedCats = (data.data?.categories ?? []).filter((c) => byCat.has(c.id));
    const groups: { category: Category | null; items: Product[] }[] = sortedCats.map((c) => ({
      category: c,
      items: (byCat.get(c.id) ?? []).sort((a, b) => a.sort_order - b.sort_order),
    }));
    // Products with no category go last under an "Uncategorized" heading.
    const uncat = byCat.get(null) ?? [];
    if (uncat.length) {
      groups.push({ category: null, items: uncat.sort((a, b) => a.sort_order - b.sort_order) });
    }
    return groups;
  }, [products, data.data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{t("menuMgmt")}</h1>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search")}
          aria-label={t("search")}
          className="ps-9 pe-9"
        />
        {query && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={t("cancel")}
            className="absolute end-1 top-1/2 size-8 -translate-y-1/2"
            onClick={() => setQuery("")}
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">{t("products")}</TabsTrigger>
          <TabsTrigger value="categories">{t("categories")}</TabsTrigger>
        </TabsList>


        <TabsContent value="products" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => setProductDialog({ ...emptyProduct })} className="gap-1.5">
              <Plus className="size-4" />
              {t("addProduct")}
            </Button>
            <label className="ms-auto flex items-center gap-2 text-sm">
              <Switch checked={showArchived} onCheckedChange={setShowArchived} />
              {t("showArchived")}
            </label>
          </div>
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            {t("archiveHint")}
          </p>

          {data.isLoading ? (
            <LoadingState />
          ) : groupedProducts.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-6">
              {groupedProducts.map((group) => {
                const cat = group.category;
                return (
                  <section key={cat?.id ?? "uncategorized"} className="space-y-3">
                    <div className="flex items-center gap-2 border-b border-border pb-1.5">
                      <h3 className="text-sm font-bold tracking-tight">
                        {cat ? pickName(lang, cat.name_ar, cat.name_en) : t("uncategorized")}
                      </h3>
                      <Badge variant="outline" className="text-[10px]">
                        #{cat?.sort_order ?? "—"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        ({group.items.length})
                      </span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {group.items.map((p) => (
                        <ProductCard
                          key={p.id}
                          p={p}
                          catSort={cat?.sort_order}
                          lang={lang}
                          t={t}
                          money={money}
                          images={images}
                          onEdit={() =>
                            setProductDialog({
                              id: p.id,
                              category_id: p.category_id ?? "",
                              name_ar: p.name_ar,
                              name_en: p.name_en,
                              description_ar: p.description_ar ?? "",
                              description_en: p.description_en ?? "",
                              image_url: p.image_url,
                              price: String(p.price),
                              is_available: p.is_available,
                              sort_order: p.sort_order,
                            })
                          }
                          onArchive={() => toggleArchive.mutate(p)}
                          archiving={toggleArchive.isPending}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}

        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <Button onClick={() => setCategoryDialog({ name_ar: "", name_en: "", sort_order: 0, is_active: true })}>
            <Plus className="size-4" />
            {t("addCategory")}
          </Button>
          <Card>
            <CardContent className="p-0">
              {categories.length === 0 ? (
                <EmptyState />
              ) : (
                <ul className="divide-y divide-border">
                  {categories.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="font-medium">{pickName(lang, c.name_ar, c.name_en)}</span>
                      <Badge variant={c.is_active ? "default" : "secondary"} className="text-[10px]">
                        {c.is_active ? t("active") : t("inactive")}
                      </Badge>
                      <span className="ms-auto text-sm text-muted-foreground">#{c.sort_order}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-9"
                        aria-label={t("edit")}
                        onClick={() => setCategoryDialog(c)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Category dialog */}
      <Dialog open={Boolean(categoryDialog)} onOpenChange={(o) => !o && setCategoryDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{categoryDialog?.id ? t("edit") : t("addCategory")}</DialogTitle>
          </DialogHeader>
          {categoryDialog && (
            <div className="space-y-3">
              <Field label={t("nameAr")}>
                <Input
                  value={categoryDialog.name_ar ?? ""}
                  onChange={(e) => setCategoryDialog({ ...categoryDialog, name_ar: e.target.value })}
                  maxLength={80}
                />
              </Field>
              <Field label={t("nameEn")}>
                <Input
                  value={categoryDialog.name_en ?? ""}
                  onChange={(e) => setCategoryDialog({ ...categoryDialog, name_en: e.target.value })}
                  maxLength={80}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("sortOrder")}>
                  <Input
                    type="number"
                    value={categoryDialog.sort_order ?? 0}
                    onChange={(e) =>
                      setCategoryDialog({ ...categoryDialog, sort_order: Number(e.target.value) || 0 })
                    }
                  />
                </Field>
                <Field label={t("active")}>
                  <Switch
                    checked={categoryDialog.is_active ?? true}
                    onCheckedChange={(v) => setCategoryDialog({ ...categoryDialog, is_active: v })}
                  />
                </Field>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialog(null)}>
              {t("cancel")}
            </Button>
            <Button
              disabled={saveCategory.isPending}
              onClick={() => categoryDialog && saveCategory.mutate(categoryDialog)}
            >
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product dialog */}
      <Dialog open={Boolean(productDialog)} onOpenChange={(o) => !o && setProductDialog(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{productDialog?.id ? t("edit") : t("addProduct")}</DialogTitle>
          </DialogHeader>
          {productDialog && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("nameAr")}>
                  <Input
                    value={productDialog.name_ar}
                    onChange={(e) => setProductDialog({ ...productDialog, name_ar: e.target.value })}
                    maxLength={120}
                  />
                </Field>
                <Field label={t("nameEn")}>
                  <Input
                    value={productDialog.name_en}
                    onChange={(e) => setProductDialog({ ...productDialog, name_en: e.target.value })}
                    maxLength={120}
                  />
                </Field>
              </div>
              <Field label={t("descAr")}>
                <Textarea
                  rows={2}
                  value={productDialog.description_ar}
                  onChange={(e) => setProductDialog({ ...productDialog, description_ar: e.target.value })}
                  maxLength={400}
                />
              </Field>
              <Field label={t("descEn")}>
                <Textarea
                  rows={2}
                  value={productDialog.description_en}
                  onChange={(e) => setProductDialog({ ...productDialog, description_en: e.target.value })}
                  maxLength={400}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label={t("price")}>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={productDialog.price}
                    onChange={(e) => setProductDialog({ ...productDialog, price: e.target.value })}
                  />
                </Field>
                <Field label={t("category")}>
                  <Select
                    value={productDialog.category_id || "none"}
                    onValueChange={(v) =>
                      setProductDialog({ ...productDialog, category_id: v === "none" ? "" : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {data.data?.categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {pickName(lang, c.name_ar, c.name_en)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={t("sortOrder")}>
                  <Input
                    type="number"
                    value={productDialog.sort_order}
                    onChange={(e) =>
                      setProductDialog({ ...productDialog, sort_order: Number(e.target.value) || 0 })
                    }
                  />
                </Field>
              </div>
              <Field label={t("image")}>
                <div className="flex items-center gap-3">
                  {productDialog.image_url && images?.[productDialog.image_url] && (
                    <img src={images[productDialog.image_url]} alt="" className="size-14 rounded-lg object-cover" />
                  )}
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-2 text-sm hover:bg-accent">
                    {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
                    {t("uploadImage")}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploading(true);
                        try {
                          const res = await uploadImageDetailed("menu-images", file);
                          setProductDialog((prev) => (prev ? { ...prev, image_url: res.path } : prev));
                          toast.success(
                            `${t("saved")} · ${formatBytes(res.originalSize)} → ${formatBytes(res.uploadedSize)}`,
                          );
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : t("error"));
                        } finally {
                          setUploading(false);
                        }
                      }}
                    />
                  </label>
                </div>
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={productDialog.is_available}
                  onCheckedChange={(v) => setProductDialog({ ...productDialog, is_available: v })}
                />
                {t("available")}
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductDialog(null)}>
              {t("cancel")}
            </Button>
            <Button
              disabled={saveProduct.isPending}
              onClick={() => productDialog && saveProduct.mutate(productDialog)}
            >
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

// Display-only product card used by the grouped Products tab. The composite "X-Y"
// label is computed from the product's category sort_order and its own sort_order —
// it is never stored, synced, or used for any logic.
function ProductCard({
  p,
  catSort,
  lang,
  t,
  money,
  images,
  onEdit,
  onArchive,
  archiving,
}: {
  p: Product;
  catSort?: number;
  lang: "ar" | "en";
  t: (k: keyof typeof dictRef) => string;
  money: (n: number) => string;
  images: Record<string, string> | undefined;
  onEdit: () => void;
  onArchive: () => void;
  archiving: boolean;
}) {
  const composite = catSort != null ? `${catSort}-${p.sort_order}` : `#${p.sort_order}`;
  return (
    <Card>
      <CardContent className="space-y-3 p-3">
        <div className="flex gap-3">
          {p.image_url && images?.[p.image_url] ? (
            <img src={images[p.image_url]} alt="" className="size-16 shrink-0 rounded-lg object-cover" />
          ) : (
            <div className="grid size-16 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
              <ImagePlus className="size-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="shrink-0 text-[10px] tabular-nums">{composite}</Badge>
              <p className="truncate font-semibold">{pickName(lang, p.name_ar, p.name_en)}</p>
            </div>
            <p className="text-sm text-primary">{money(p.price)}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              <Badge variant={p.is_available ? "default" : "secondary"} className="text-[10px]">
                {p.is_available ? t("available") : t("outOfStock")}
              </Badge>
              {p.is_archived && (
                <Badge variant="outline" className="text-[10px]">
                  {t("archived")}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="default" className="flex-1 gap-1.5" onClick={onEdit}>
            <Pencil className="size-4" />
            {t("edit")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={onArchive}
            disabled={archiving}
            title={t("archiveHint")}
          >
            {p.is_archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
            <span className="text-xs">{p.is_archived ? t("unarchive") : t("archive")}</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
