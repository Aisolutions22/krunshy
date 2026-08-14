-- 1. Balance: only confirmed/completed ACCOUNT orders count
CREATE OR REPLACE FUNCTION public.customer_balance(_customer_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COALESCE((SELECT SUM(total) FROM public.orders
      WHERE customer_id = _customer_id AND order_type = 'ACCOUNT'
        AND status IN ('confirmed','completed')), 0)
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
      AND status IN ('confirmed','completed')
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

-- 2. Confirmation message text
CREATE OR REPLACE FUNCTION public.on_order_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_title_ar text; v_title_en text; v_msg_ar text; v_msg_en text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;

  IF NEW.status = 'confirmed' THEN
    v_title_ar := 'تم تأكيد طلبك'; v_title_en := 'Order confirmed';
    v_msg_ar := E'تم تأكيد طلبك بنجاح\nوجاري تحضيره\nوسنقوم بإبلاغك فور الانتهاء';
    v_msg_en := 'Your order has been confirmed and is now being prepared. We''ll let you know as soon as it''s ready.';
  ELSIF NEW.status = 'completed' THEN
    v_title_ar := 'تم تنفيذ طلبك'; v_title_en := 'Order completed';
    IF NEW.order_type = 'ACCOUNT' THEN
      v_msg_ar := 'تم تنفيذ طلبك وتحديث حسابك'; v_msg_en := 'Your order is done and your account was updated';
    ELSE
      v_msg_ar := 'تم تأكيد وتنفيذ طلبك'; v_msg_en := 'Your order was confirmed and completed';
    END IF;
  ELSIF NEW.status = 'cancelled' THEN
    v_title_ar := 'تم إلغاء طلبك'; v_title_en := 'Order cancelled';
    v_msg_ar := 'تم إلغاء طلبك'; v_msg_en := 'Your order has been cancelled';
  ELSE
    v_title_ar := 'تحديث الطلب'; v_title_en := 'Order update';
    v_msg_ar := 'تم تحديث حالة طلبك'; v_msg_en := 'Your order status changed';
  END IF;

  IF NEW.customer_id IS NOT NULL THEN
    INSERT INTO public.notifications (recipient_role, recipient_id, order_id, title_ar, title_en, message_ar, message_en)
    VALUES ('customer', NEW.customer_id, NEW.id, v_title_ar, v_title_en, v_msg_ar, v_msg_en);
  END IF;

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

-- 3. Guest order items by token
CREATE OR REPLACE FUNCTION public.order_track_items_by_token(_client_token text)
RETURNS TABLE(product_name text, product_name_en text, quantity integer, unit_price numeric, line_total numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT i.product_name_snapshot, i.product_name_en_snapshot, i.quantity, i.unit_price_snapshot, i.line_total
  FROM public.order_items i
  JOIN public.orders o ON o.id = i.order_id
  WHERE o.client_token = _client_token
  ORDER BY i.created_at;
$$;

REVOKE ALL ON FUNCTION public.order_track_items_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.order_track_items_by_token(text) TO anon, authenticated;

-- 4. Admin-only server-side mark as paid
CREATE OR REPLACE FUNCTION public.mark_order_paid(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE o public.orders%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admins only'; END IF;

  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF o.status = 'cancelled' THEN RAISE EXCEPTION 'Cancelled orders cannot be paid'; END IF;
  IF o.payment_status = 'paid' THEN RETURN; END IF;

  UPDATE public.orders
    SET payment_status = 'paid', paid_at = now(), paid_by = auth.uid()
    WHERE id = _order_id;

  IF o.order_type = 'ACCOUNT' AND o.customer_id IS NOT NULL THEN
    INSERT INTO public.payments (customer_id, order_id, amount, method, recorded_by, paid_on)
    VALUES (o.customer_id, o.id, o.total, 'cash', auth.uid(), CURRENT_DATE);
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, previous_value, new_value)
  VALUES (auth.uid(), 'mark_paid', 'order', _order_id,
          jsonb_build_object('payment_status', o.payment_status),
          jsonb_build_object('payment_status', 'paid', 'amount', o.total));
END; $$;

REVOKE ALL ON FUNCTION public.mark_order_paid(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_order_paid(uuid) TO authenticated;