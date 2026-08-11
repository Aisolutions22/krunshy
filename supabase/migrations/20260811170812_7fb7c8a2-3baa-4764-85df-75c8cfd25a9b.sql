CREATE OR REPLACE FUNCTION public.order_number_by_token(_client_token text)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT order_number FROM public.orders WHERE client_token = _client_token LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.order_number_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.order_number_by_token(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.customer_accounts_summary()
RETURNS TABLE (
  customer_id uuid,
  email text,
  full_name text,
  display_name text,
  department text,
  phone text,
  approval_status approval_status,
  total_ordered numeric,
  total_paid numeric,
  balance numeric,
  last_order_at timestamptz,
  last_payment_on date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.email,
    p.full_name,
    p.display_name,
    p.department,
    p.phone,
    p.approval_status,
    COALESCE(o.total_ordered, 0)::numeric,
    COALESCE(pay.total_paid, 0)::numeric,
    (COALESCE(o.total_ordered, 0) - COALESCE(pay.total_paid, 0))::numeric,
    o.last_order_at,
    pay.last_payment_on
  FROM public.profiles p
  LEFT JOIN (
    SELECT customer_id, SUM(total) AS total_ordered, MAX(created_at) AS last_order_at
    FROM public.orders
    WHERE customer_id IS NOT NULL AND status <> 'cancelled'
    GROUP BY customer_id
  ) o ON o.customer_id = p.id
  LEFT JOIN (
    SELECT customer_id, SUM(amount) AS total_paid, MAX(paid_on) AS last_payment_on
    FROM public.payments
    GROUP BY customer_id
  ) pay ON pay.customer_id = p.id
  WHERE public.is_admin()
  ORDER BY p.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.customer_accounts_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_accounts_summary() TO authenticated;