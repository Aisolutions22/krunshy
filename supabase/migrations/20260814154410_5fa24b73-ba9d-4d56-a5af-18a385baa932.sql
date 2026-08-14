-- 1) customer language on orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_language text NOT NULL DEFAULT 'ar';

-- 2) notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_role text NOT NULL CHECK (recipient_role IN ('admin','customer')),
  recipient_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  title_ar text NOT NULL,
  title_en text NOT NULL,
  message_ar text NOT NULL,
  message_en text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT TO authenticated
  USING (
    (recipient_role = 'customer' AND recipient_id = auth.uid())
    OR (recipient_role = 'admin' AND public.is_admin())
  );

DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE TO authenticated
  USING (
    (recipient_role = 'customer' AND recipient_id = auth.uid())
    OR (recipient_role = 'admin' AND public.is_admin())
  )
  WITH CHECK (
    (recipient_role = 'customer' AND recipient_id = auth.uid())
    OR (recipient_role = 'admin' AND public.is_admin())
  );

CREATE INDEX IF NOT EXISTS notifications_recipient_idx ON public.notifications (recipient_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_admin_idx ON public.notifications (recipient_role, is_read, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- 3) status change trigger: notifications + payment linkage
CREATE OR REPLACE FUNCTION public.on_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_title_ar text; v_title_en text; v_msg_ar text; v_msg_en text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;

  IF NEW.status = 'confirmed' THEN
    v_title_ar := 'تم تأكيد طلبك'; v_title_en := 'Order confirmed';
    v_msg_ar := 'تم استلام طلبك وجاري العمل عليه'; v_msg_en := 'We received your order and are working on it';
  ELSIF NEW.status = 'completed' THEN
    IF NEW.order_type = 'ACCOUNT' THEN
      v_title_ar := 'تم تنفيذ طلبك'; v_title_en := 'Order completed';
      v_msg_ar := 'تم تنفيذ طلبك وتحديث حسابك'; v_msg_en := 'Your order is done and your account was updated';
    ELSE
      v_title_ar := 'تم تنفيذ طلبك'; v_title_en := 'Order completed';
      v_msg_ar := 'تم تأكيد وتنفيذ طلبك'; v_msg_en := 'Your order was confirmed and completed';
    END IF;
  ELSIF NEW.status = 'cancelled' THEN
    v_title_ar := 'تم إلغاء طلبك'; v_title_en := 'Order cancelled';
    v_msg_ar := 'تم إلغاء طلبك'; v_msg_en := 'Your order has been cancelled';
  ELSE
    v_title_ar := 'تحديث الطلب'; v_title_en := 'Order update';
    v_msg_ar := 'تم تحديث حالة طلبك'; v_msg_en := 'Your order status changed';
  END IF;

  -- customer notification only when the order belongs to a registered account
  IF NEW.customer_id IS NOT NULL THEN
    INSERT INTO public.notifications (recipient_role, recipient_id, order_id, title_ar, title_en, message_ar, message_en)
    VALUES ('customer', NEW.customer_id, NEW.id, v_title_ar, v_title_en, v_msg_ar, v_msg_en);
  END IF;

  -- admin history row for every status change
  INSERT INTO public.notifications (recipient_role, recipient_id, order_id, title_ar, title_en, message_ar, message_en)
  VALUES (
    'admin', NULL, NEW.id,
    'تغيير حالة الطلب #' || NEW.order_number,
    'Order #' || NEW.order_number || ' status changed',
    'الحالة: ' || OLD.status::text || ' ← ' || NEW.status::text,
    'Status: ' || OLD.status::text || ' -> ' || NEW.status::text
  );

  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public.on_order_status_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS orders_status_change ON public.orders;
CREATE TRIGGER orders_status_change
AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.on_order_status_change();

-- 4) admin-only server-side status transition
CREATE OR REPLACE FUNCTION public.set_order_status(_order_id uuid, _status order_status)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE o public.orders%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admins only'; END IF;

  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF o.status = _status THEN RETURN; END IF;

  IF NOT (
    (_status = 'confirmed' AND o.status = 'pending')
    OR (_status = 'completed' AND o.status = 'confirmed')
    OR (_status = 'cancelled' AND o.status IN ('pending','confirmed'))
  ) THEN
    RAISE EXCEPTION 'Invalid status transition % -> %', o.status, _status;
  END IF;

  -- cash orders settle on completion (same mark-as-paid semantics used by admins)
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
END; $$;

REVOKE ALL ON FUNCTION public.set_order_status(uuid, order_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_order_status(uuid, order_status) TO authenticated;

-- 5) guest order tracking by client token (no account required)
CREATE OR REPLACE FUNCTION public.order_track_by_token(_client_token text)
RETURNS TABLE(order_number bigint, status order_status, order_type order_type, total numeric, customer_language text, created_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT o.order_number, o.status, o.order_type, o.total, o.customer_language, o.created_at
  FROM public.orders o
  WHERE o.client_token = _client_token
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.order_track_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.order_track_by_token(text) TO anon, authenticated;

-- 6) create_order keeps its signature but records the customer language
CREATE OR REPLACE FUNCTION public.create_order(_items jsonb, _order_type order_type, _visitor_name text DEFAULT NULL::text, _visitor_phone text DEFAULT NULL::text, _notes text DEFAULT NULL::text, _client_token text DEFAULT NULL::text, _language text DEFAULT 'ar'::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id UUID;
  v_customer UUID := auth.uid();
  v_total NUMERIC(12,2) := 0;
  v_item JSONB;
  v_product public.products%ROWTYPE;
  v_qty INTEGER;
  v_existing UUID;
BEGIN
  IF _client_token IS NOT NULL THEN
    SELECT id INTO v_existing FROM public.orders WHERE client_token = _client_token;
    IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
  END IF;

  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Order must contain at least one item';
  END IF;

  IF _order_type = 'ACCOUNT' THEN
    IF v_customer IS NULL THEN RAISE EXCEPTION 'Sign in required for account orders'; END IF;
    IF NOT public.is_approved_customer() THEN RAISE EXCEPTION 'Account not approved'; END IF;
  ELSE
    v_customer := NULL;
  END IF;

  INSERT INTO public.orders (customer_id, visitor_name, visitor_phone, order_type, notes, client_token, payment_status, customer_language)
  VALUES (v_customer, NULLIF(_visitor_name,''), NULLIF(_visitor_phone,''), _order_type, NULLIF(_notes,''), _client_token, 'unpaid',
          CASE WHEN _language = 'en' THEN 'en' ELSE 'ar' END)
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_qty := GREATEST(1, LEAST(999, COALESCE((v_item ->> 'quantity')::INT, 1)));
    SELECT * INTO v_product FROM public.products
      WHERE id = (v_item ->> 'product_id')::UUID AND is_available AND NOT is_archived;
    IF v_product.id IS NULL THEN RAISE EXCEPTION 'Product unavailable'; END IF;
    INSERT INTO public.order_items (order_id, product_id, product_name_snapshot, product_name_en_snapshot, unit_price_snapshot, quantity, line_total)
    VALUES (v_order_id, v_product.id, v_product.name_ar, v_product.name_en, v_product.price, v_qty, v_product.price * v_qty);
    v_total := v_total + (v_product.price * v_qty);
  END LOOP;

  UPDATE public.orders SET subtotal = v_total, total = v_total WHERE id = v_order_id;
  RETURN v_order_id;
END; $function$;

REVOKE ALL ON FUNCTION public.create_order(jsonb, order_type, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order(jsonb, order_type, text, text, text, text, text) TO anon, authenticated;
DROP FUNCTION IF EXISTS public.create_order(jsonb, order_type, text, text, text, text);