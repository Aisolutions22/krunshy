ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS staff_allowed_pages text[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.has_staff_page(_page text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = auth.uid() AND ur.role = 'sales_staff'
      AND p.is_active = true AND _page = ANY(p.staff_allowed_pages)
  );
$$;
REVOKE ALL ON FUNCTION public.has_staff_page(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_staff_page(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_staff_page(text) TO authenticated, service_role;

-- ORDERS
DROP POLICY IF EXISTS orders_select_own_or_admin ON public.orders;
CREATE POLICY orders_select_own_or_admin ON public.orders
FOR SELECT TO authenticated
USING ((customer_id = auth.uid()) OR public.is_admin() OR public.has_staff_page('orders'));

CREATE OR REPLACE FUNCTION public.set_order_status(_order_id uuid, _status order_status)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE o public.orders%ROWTYPE;
BEGIN
  IF NOT (public.is_admin() OR public.has_staff_page('orders')) THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF (NOT public.is_admin()) AND _status = 'cancelled' THEN
    RAISE EXCEPTION 'Sales staff cannot cancel orders';
  END IF;

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

-- MENU
DROP POLICY IF EXISTS categories_admin_insert ON public.categories;
CREATE POLICY categories_admin_insert ON public.categories
FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.has_staff_page('menu'));
DROP POLICY IF EXISTS categories_admin_update ON public.categories;
CREATE POLICY categories_admin_update ON public.categories
FOR UPDATE TO authenticated USING (public.is_admin() OR public.has_staff_page('menu'))
WITH CHECK (public.is_admin() OR public.has_staff_page('menu'));

DROP POLICY IF EXISTS products_admin_insert ON public.products;
CREATE POLICY products_admin_insert ON public.products
FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.has_staff_page('menu'));
DROP POLICY IF EXISTS products_admin_update ON public.products;
CREATE POLICY products_admin_update ON public.products
FOR UPDATE TO authenticated USING (public.is_admin() OR public.has_staff_page('menu'))
WITH CHECK (public.is_admin() OR public.has_staff_page('menu'));

-- EXPENSES
DROP POLICY IF EXISTS expenses_admin_all ON public.expenses;
CREATE POLICY expenses_admin_all ON public.expenses
FOR ALL TO authenticated USING (public.is_admin() OR public.has_staff_page('expenses'))
WITH CHECK (public.is_admin() OR public.has_staff_page('expenses'));

-- CUSTOMERS
DROP POLICY IF EXISTS profiles_select_own_or_admin ON public.profiles;
CREATE POLICY profiles_select_own_or_admin ON public.profiles
FOR SELECT TO authenticated
USING ((id = auth.uid()) OR public.is_admin() OR public.has_staff_page('customers'));

DROP POLICY IF EXISTS profiles_update_admin ON public.profiles;
CREATE POLICY profiles_update_admin ON public.profiles
FOR UPDATE TO authenticated USING (public.is_admin() OR public.has_staff_page('customers'))
WITH CHECK (public.is_admin() OR public.has_staff_page('customers'));

DROP POLICY IF EXISTS payments_admin_insert ON public.payments;
CREATE POLICY payments_admin_insert ON public.payments
FOR INSERT TO authenticated
WITH CHECK ((public.is_admin() OR public.has_staff_page('customers')) AND recorded_by = auth.uid());

DROP POLICY IF EXISTS payments_select_own_or_admin ON public.payments;
CREATE POLICY payments_select_own_or_admin ON public.payments
FOR SELECT TO authenticated
USING ((customer_id = auth.uid()) OR public.is_admin() OR public.has_staff_page('customers'));

DROP POLICY IF EXISTS closings_admin_insert ON public.account_closings;
CREATE POLICY closings_admin_insert ON public.account_closings
FOR INSERT TO authenticated
WITH CHECK ((public.is_admin() OR public.has_staff_page('customers')) AND closed_by = auth.uid());

DROP POLICY IF EXISTS closings_select_own_or_admin ON public.account_closings;
CREATE POLICY closings_select_own_or_admin ON public.account_closings
FOR SELECT TO authenticated
USING ((customer_id = auth.uid()) OR public.is_admin() OR public.has_staff_page('customers'));

DROP POLICY IF EXISTS order_items_select_own_or_admin ON public.order_items;
CREATE POLICY order_items_select_own_or_admin ON public.order_items
FOR SELECT TO authenticated
USING (public.is_admin() OR public.has_staff_page('orders') OR public.has_staff_page('customers')
  OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.customer_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.customer_accounts_summary()
 RETURNS TABLE(customer_id uuid, email text, full_name text, display_name text, department text, phone text, approval_status approval_status, total_ordered numeric, total_paid numeric, balance numeric, last_order_at timestamp with time zone, last_payment_on date)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
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
      AND ord.status = 'completed'
      AND ord.created_at > COALESCE(lc.cutoff, '-infinity'::timestamptz)
  ) o ON TRUE
  LEFT JOIN LATERAL (
    SELECT SUM(pm.amount) AS total_paid, MAX(pm.paid_on) AS last_payment_on
    FROM public.payments pm
    WHERE pm.customer_id = p.id
      AND pm.created_at > COALESCE(lc.cutoff, '-infinity'::timestamptz)
  ) pay ON TRUE
  WHERE public.is_admin() OR public.has_staff_page('customers') OR public.has_staff_page('reports')
  ORDER BY p.created_at DESC;
$function$;

CREATE OR REPLACE FUNCTION public.collections_total(_from timestamp with time zone, _to timestamp with time zone)
 RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN public.is_admin() OR public.has_staff_page('reports') THEN
    ROUND(
      COALESCE((
        SELECT SUM(o.total) FROM public.orders o
        WHERE o.order_type = 'CASH'
          AND o.status = 'completed'
          AND o.paid_at IS NOT NULL
          AND o.paid_at >= _from
          AND o.paid_at <= _to
      ), 0)
      +
      COALESCE((
        SELECT SUM(p.amount) FROM public.payments p
        WHERE p.paid_on >= (_from AT TIME ZONE 'Africa/Cairo')::date
          AND p.paid_on <= (_to AT TIME ZONE 'Africa/Cairo')::date
      ), 0)
    , 2) + 0
  ELSE 0::numeric END
$function$;

CREATE OR REPLACE FUNCTION public.product_sales_report(_from timestamp with time zone, _to timestamp with time zone)
 RETURNS TABLE(product_id uuid, name_ar text, name_en text, quantity_sold bigint, revenue numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT
    oi.product_id,
    COALESCE(p.name_ar, MIN(oi.product_name_snapshot)) AS name_ar,
    COALESCE(p.name_en, MIN(oi.product_name_en_snapshot)) AS name_en,
    SUM(oi.quantity)::bigint AS quantity_sold,
    ROUND(SUM(oi.line_total), 2) + 0 AS revenue
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  LEFT JOIN public.products p ON p.id = oi.product_id
  WHERE (public.is_admin() OR public.has_staff_page('reports'))
    AND o.status = 'completed'
    AND o.created_at >= _from
    AND o.created_at <= _to
  GROUP BY oi.product_id, p.name_ar, p.name_en
  ORDER BY SUM(oi.quantity) DESC;
$function$;

CREATE OR REPLACE FUNCTION public.close_account(_customer_id uuid, _note text DEFAULT NULL::text)
 RETURNS account_closings LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_cutoff timestamptz;
  v_period_start date;
  v_balance numeric;
  v_paid numeric;
  v_row public.account_closings;
BEGIN
  IF NOT (public.is_admin() OR public.has_staff_page('customers')) THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF _customer_id IS NULL THEN RAISE EXCEPTION 'Customer required'; END IF;

  PERFORM 1 FROM public.profiles WHERE id = _customer_id FOR UPDATE;

  SELECT ac.closed_at INTO v_cutoff
  FROM public.account_closings ac
  WHERE ac.customer_id = _customer_id
  ORDER BY ac.closed_at DESC
  LIMIT 1;

  v_period_start := (COALESCE(v_cutoff, now()) AT TIME ZONE 'Africa/Cairo')::date;

  v_balance := public.customer_balance(_customer_id);

  SELECT COALESCE(SUM(p.amount), 0) INTO v_paid
  FROM public.payments p
  WHERE p.customer_id = _customer_id
    AND p.created_at > COALESCE(v_cutoff, '-infinity'::timestamptz);

  INSERT INTO public.account_closings (customer_id, period_start, period_end, amount_settled, outstanding_after, note, closed_by, closed_at)
  VALUES (_customer_id, v_period_start, (now() AT TIME ZONE 'Africa/Cairo')::date,
          ROUND(v_paid, 2), ROUND(v_balance, 2), NULLIF(_note, ''), auth.uid(), now())
  RETURNING * INTO v_row;

  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, previous_value, new_value)
  VALUES (auth.uid(), 'close_account', 'account_closing', v_row.id, NULL,
          jsonb_build_object('customer_id', _customer_id, 'outstanding_after', v_row.outstanding_after, 'amount_settled', v_row.amount_settled));

  RETURN v_row;
END; $function$;

CREATE OR REPLACE FUNCTION public.void_payment(_payment_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE p public.payments%ROWTYPE;
BEGIN
  IF NOT (public.is_admin() OR public.has_staff_page('customers')) THEN RAISE EXCEPTION 'Admins only'; END IF;
  SELECT * INTO p FROM public.payments WHERE id = _payment_id FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Payment not found'; END IF;

  DELETE FROM public.payments WHERE id = _payment_id;

  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, previous_value, new_value)
  VALUES (auth.uid(), 'void_payment', 'payment', _payment_id,
          jsonb_build_object('amount', p.amount, 'customer_id', p.customer_id, 'paid_on', p.paid_on),
          NULL);
END; $function$;

CREATE OR REPLACE FUNCTION public.log_audit(_action text, _entity text, _entity_id uuid DEFAULT NULL::uuid, _previous_value jsonb DEFAULT NULL::jsonb, _new_value jsonb DEFAULT NULL::jsonb)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.is_admin() OR public.is_sales_staff()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF _action IS NULL OR _entity IS NULL OR length(_action) > 64 OR length(_entity) > 64 THEN
    RAISE EXCEPTION 'invalid audit payload';
  END IF;
  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, previous_value, new_value)
  VALUES (auth.uid(), _action, _entity, _entity_id, _previous_value, _new_value);
END;
$function$;