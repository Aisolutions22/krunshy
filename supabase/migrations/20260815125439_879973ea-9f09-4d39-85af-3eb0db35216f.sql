-- Period-aware ledger. Sign convention: negative = customer owes money.
CREATE OR REPLACE FUNCTION public.customer_balance(_customer_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
          AND o.status IN ('confirmed','completed')
          AND o.created_at > c.cutoff), 0)
    + COALESCE((SELECT SUM(p.amount) FROM public.payments p
        WHERE p.customer_id = _customer_id
          AND p.created_at > c.cutoff), 0)
  , 2) + 0
  FROM c;
$function$;

CREATE OR REPLACE FUNCTION public.customer_accounts_summary()
RETURNS TABLE(customer_id uuid, email text, full_name text, display_name text, department text, phone text, approval_status approval_status, total_ordered numeric, total_paid numeric, balance numeric, last_order_at timestamp with time zone, last_payment_on date)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
      AND ord.status IN ('confirmed','completed')
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
$function$;

-- Allow admins to cancel already-recognized orders (financial effect reverses live)
CREATE OR REPLACE FUNCTION public.set_order_status(_order_id uuid, _status order_status)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE o public.orders%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admins only'; END IF;

  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF o.status = _status THEN RETURN; END IF;

  IF NOT (
    (_status = 'confirmed' AND o.status = 'pending')
    OR (_status = 'completed' AND o.status = 'confirmed')
    OR (_status = 'cancelled' AND o.status IN ('pending','confirmed','completed'))
  ) THEN
    RAISE EXCEPTION 'Invalid status transition % -> %', o.status, _status;
  END IF;

  IF _status = 'completed' AND o.order_type = 'CASH' AND o.payment_status = 'unpaid' THEN
    UPDATE public.orders
      SET status = _status, payment_status = 'paid', paid_at = now(), paid_by = auth.uid()
      WHERE id = _order_id;
  ELSE
    UPDATE public.orders SET status = _status WHERE id = _order_id;
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, previous_value, new_value)
  VALUES (auth.uid(), 'order_status', 'order', _order_id,
          jsonb_build_object('status', o.status), jsonb_build_object('status', _status));
END; $function$;

-- Admin-only payment void
CREATE OR REPLACE FUNCTION public.void_payment(_payment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE p public.payments%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admins only'; END IF;
  SELECT * INTO p FROM public.payments WHERE id = _payment_id FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Payment not found'; END IF;

  DELETE FROM public.payments WHERE id = _payment_id;

  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, previous_value, new_value)
  VALUES (auth.uid(), 'void_payment', 'payment', _payment_id,
          jsonb_build_object('amount', p.amount, 'customer_id', p.customer_id, 'paid_on', p.paid_on),
          NULL);
END; $function$;

REVOKE ALL ON FUNCTION public.void_payment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.void_payment(uuid) TO authenticated;