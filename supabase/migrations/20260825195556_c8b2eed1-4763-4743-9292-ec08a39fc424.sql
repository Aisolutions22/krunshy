-- 1) Backfill ONLY products.sort_order, preserving current visual order per category.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY category_id ORDER BY sort_order, created_at, id
  )::int AS rn
  FROM public.products
)
UPDATE public.products p
SET sort_order = r.rn
FROM ranked r
WHERE p.id = r.id AND p.sort_order IS DISTINCT FROM r.rn;

-- 2) Duplicate prevention (server-side)
CREATE UNIQUE INDEX IF NOT EXISTS categories_sort_order_key
  ON public.categories (sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS products_category_sort_order_key
  ON public.products (category_id, sort_order);

-- 3) Auto-assignment on creation
CREATE OR REPLACE FUNCTION public.assign_category_sort_order()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.sort_order IS NULL OR NEW.sort_order = 0 THEN
    SELECT COALESCE(MAX(sort_order), 0) + 1 INTO NEW.sort_order FROM public.categories;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.assign_product_sort_order()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.sort_order IS NULL OR NEW.sort_order = 0 THEN
    SELECT COALESCE(MAX(sort_order), 0) + 1 INTO NEW.sort_order
    FROM public.products
    WHERE category_id IS NOT DISTINCT FROM NEW.category_id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS categories_assign_sort_order ON public.categories;
CREATE TRIGGER categories_assign_sort_order
  BEFORE INSERT ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.assign_category_sort_order();

DROP TRIGGER IF EXISTS products_assign_sort_order ON public.products;
CREATE TRIGGER products_assign_sort_order
  BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.assign_product_sort_order();