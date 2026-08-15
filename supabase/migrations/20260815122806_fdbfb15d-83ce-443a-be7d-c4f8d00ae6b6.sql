-- Single source of truth: only 'completed' orders affect revenue/balance
CREATE OR REPLACE FUNCTION public.customer_balance(_customer_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COALESCE((SELECT SUM(total) FROM public.orders
      WHERE customer_id = _customer_id AND order_type = 'ACCOUNT'
        AND status = 'completed'), 0)
       - COALESCE((SELECT SUM(amount) FROM public.payments WHERE customer_id = _customer_id), 0);
$$;

CREATE OR REPLACE FUNCTION public.customer_accounts_summary()
RETURNS TABLE(customer_id uuid, email text, full_name text, display_name text, department text, phone text, approval_status approval_status, total_ordered numeric, total_paid numeric, balance numeric, last_order_at timestamp with time zone, last_payment_on date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    p.id, p.email, p.full_name, p.display_name, p.department, p.phone, p.approval_status,
    COALESCE(o.total_ordered, 0)::numeric,
    COALESCE(pay.total_paid, 0)::numeric,
    (COALESCE(o.total_ordered, 0) - COALESCE(pay.total_paid, 0))::numeric,
    o.last_order_at,
    pay.last_payment_on
  FROM public.profiles p
  LEFT JOIN (
    SELECT customer_id, SUM(total) AS total_ordered, MAX(created_at) AS last_order_at
    FROM public.orders
    WHERE customer_id IS NOT NULL AND order_type = 'ACCOUNT'
      AND status = 'completed'
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

REVOKE ALL ON FUNCTION public.customer_balance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_balance(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.customer_accounts_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_accounts_summary() TO authenticated;