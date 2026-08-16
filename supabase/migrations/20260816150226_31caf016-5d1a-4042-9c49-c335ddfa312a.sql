CREATE OR REPLACE FUNCTION public.customer_balance(_customer_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH last_closing AS (
    SELECT outstanding_after, closed_at
    FROM public.account_closings
    WHERE customer_id = _customer_id
    ORDER BY closed_at DESC
    LIMIT 1
  ), c AS (
    SELECT
      COALESCE((SELECT outstanding_after FROM last_closing), 0)::numeric AS opening,
      COALESCE((SELECT closed_at FROM last_closing), '-infinity'::timestamptz) AS cutoff
  )
  SELECT ROUND(
    c.opening
    - COALESCE((SELECT SUM(o.total) FROM public.orders o
        WHERE o.customer_id = _customer_id
          AND o.order_type = 'ACCOUNT'
          AND o.status = 'completed'
          AND o.created_at > c.cutoff), 0)
    + COALESCE((SELECT SUM(p.amount) FROM public.payments p
        WHERE p.customer_id = _customer_id
          AND p.created_at > c.cutoff), 0)
  , 2) + 0
  FROM c;
$$;

CREATE OR REPLACE FUNCTION public.customer_accounts_summary()
RETURNS TABLE(customer_id uuid, email text, full_name text, display_name text, department text, phone text, approval_status approval_status, total_ordered numeric, total_paid numeric, balance numeric, last_order_at timestamp with time zone, last_payment_on date)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    p.id, p.email, p.full_name, p.display_name, p.department, p.phone, p.approval_status,
    ROUND(COALESCE(o.total_ordered, 0), 2) + 0,
    ROUND(COALESCE(pay.total_paid, 0), 2) + 0,
    ROUND(COALESCE(lc.opening, 0) - COALESCE(o.total_ordered, 0) + COALESCE(pay.total_paid, 0), 2) + 0,
    o.last_order_at,
    pay.last_payment_on
  FROM public.profiles p
  LEFT JOIN LATERAL (
    SELECT ac.outstanding_after AS opening, ac.closed_at AS cutoff
    FROM public.account_closings ac
    WHERE ac.customer_id = p.id
    ORDER BY ac.closed_at DESC
    LIMIT 1
  ) lc ON TRUE
  LEFT JOIN LATERAL (
    SELECT SUM(ord.total) AS total_ordered, MAX(ord.created_at) AS last_order_at
    FROM public.orders ord
    WHERE ord.customer_id = p.id
      AND ord.order_type = 'ACCOUNT'
      AND ord.status = 'completed'
      AND ord.created_at > COALESCE(lc.cutoff, '-infinity'::timestamptz)
  ) o ON TRUE
  LEFT JOIN LATERAL (
    SELECT SUM(pm.amount) AS total_paid, MAX(pm.paid_on) AS last_payment_on
    FROM public.payments pm
    WHERE pm.customer_id = p.id
      AND pm.created_at > COALESCE(lc.cutoff, '-infinity'::timestamptz)
  ) pay ON TRUE
  WHERE public.is_admin()
  ORDER BY p.created_at DESC;
$$;