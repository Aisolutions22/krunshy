CREATE OR REPLACE FUNCTION public.product_sales_report(_from timestamptz, _to timestamptz)
RETURNS TABLE(product_id uuid, name_ar text, name_en text, quantity_sold bigint, revenue numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    oi.product_id,
    COALESCE(p.name_ar, MIN(oi.product_name_snapshot)) AS name_ar,
    COALESCE(p.name_en, MIN(oi.product_name_en_snapshot)) AS name_en,
    SUM(oi.quantity)::bigint AS quantity_sold,
    ROUND(SUM(oi.line_total), 2) + 0 AS revenue
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  LEFT JOIN public.products p ON p.id = oi.product_id
  WHERE public.is_admin()
    AND o.status = 'completed'
    AND o.created_at >= _from
    AND o.created_at <= _to
  GROUP BY oi.product_id, p.name_ar, p.name_en
  ORDER BY SUM(oi.quantity) DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.product_sales_report(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.product_sales_report(timestamptz, timestamptz) TO authenticated;