DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own ON public.notifications
FOR SELECT TO authenticated
USING (
  ((recipient_role = 'customer') AND (recipient_id = auth.uid()))
  OR ((recipient_role = 'admin') AND (public.is_admin() OR public.has_staff_page('orders')))
);

DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own ON public.notifications
FOR UPDATE TO authenticated
USING (
  ((recipient_role = 'customer') AND (recipient_id = auth.uid()))
  OR ((recipient_role = 'admin') AND (public.is_admin() OR public.has_staff_page('orders')))
)
WITH CHECK (
  ((recipient_role = 'customer') AND (recipient_id = auth.uid()))
  OR ((recipient_role = 'admin') AND (public.is_admin() OR public.has_staff_page('orders')))
);

CREATE OR REPLACE FUNCTION public.set_order_status(_order_id uuid, _status order_status)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE o public.orders%ROWTYPE;
BEGIN
  IF NOT (public.is_admin() OR public.has_staff_page('orders')) THEN RAISE EXCEPTION 'Admins only'; END IF;

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