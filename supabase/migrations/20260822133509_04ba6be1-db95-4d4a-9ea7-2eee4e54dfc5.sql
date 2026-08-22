CREATE OR REPLACE FUNCTION public.is_sales_staff()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'sales_staff'
      AND p.is_active = true
  );
$$;

REVOKE ALL ON FUNCTION public.is_sales_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_sales_staff() TO authenticated, service_role;

DROP POLICY IF EXISTS orders_select_own_or_admin ON public.orders;
CREATE POLICY orders_select_own_or_admin ON public.orders
FOR SELECT TO authenticated
USING ((customer_id = auth.uid()) OR is_admin() OR public.is_sales_staff());

CREATE OR REPLACE FUNCTION public.set_order_status(_order_id uuid, _status order_status)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE o public.orders%ROWTYPE;
BEGIN
  IF NOT (public.is_admin() OR public.is_sales_staff()) THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF (NOT public.is_admin()) AND public.is_sales_staff() AND _status = 'cancelled' THEN
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