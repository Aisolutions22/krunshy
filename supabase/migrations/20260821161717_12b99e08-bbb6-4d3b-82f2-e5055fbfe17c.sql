
CREATE OR REPLACE FUNCTION public.order_display_name(_order public.orders)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(BTRIM(_order.visitor_name), ''),
    (SELECT COALESCE(NULLIF(BTRIM(p.display_name), ''), NULLIF(BTRIM(p.full_name), ''), p.email)
     FROM public.profiles p WHERE p.id = _order.customer_id),
    'زائر'
  );
$$;

REVOKE ALL ON FUNCTION public.order_display_name(public.orders) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.on_order_created_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_name text;
BEGIN
  IF COALESCE(NEW.total, 0) <= 0 THEN RETURN NEW; END IF;

  IF EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.order_id = NEW.id AND n.recipient_role = 'admin' AND n.title_ar LIKE 'طلب جديد%'
  ) THEN
    RETURN NEW;
  END IF;

  v_name := public.order_display_name(NEW);

  INSERT INTO public.notifications (recipient_role, recipient_id, order_id, title_ar, title_en, message_ar, message_en)
  VALUES (
    'admin', NULL, NEW.id,
    'طلب جديد #' || NEW.order_number,
    'New order #' || NEW.order_number,
    CASE WHEN NEW.order_type = 'CASH' THEN 'طلب كاش' ELSE 'طلب آجل' END
      || ' — ' || v_name || ' — بقيمة ' || to_char(NEW.total, 'FM999999990.00'),
    CASE WHEN NEW.order_type = 'CASH' THEN 'Cash order' ELSE 'Account order' END
      || ' — ' || v_name || ' — ' || to_char(NEW.total, 'FM999999990.00')
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS orders_created_notify_update ON public.orders;
CREATE TRIGGER orders_created_notify_update
AFTER UPDATE OF total ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.on_order_created_notify();

CREATE OR REPLACE FUNCTION public.on_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title_ar text; v_title_en text; v_msg_ar text; v_msg_en text; v_name text; v_amt text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;

  v_name := public.order_display_name(NEW);
  v_amt := to_char(COALESCE(NEW.total, 0), 'FM999999990.00');

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

  v_msg_ar := v_msg_ar || E'\n' || 'قيمة الطلب: ' || v_amt;
  v_msg_en := v_msg_en || E'\n' || 'Order total: ' || v_amt;

  IF NEW.customer_id IS NOT NULL THEN
    INSERT INTO public.notifications (recipient_role, recipient_id, order_id, title_ar, title_en, message_ar, message_en)
    VALUES ('customer', NEW.customer_id, NEW.id, v_title_ar, v_title_en, v_msg_ar, v_msg_en);
  END IF;

  INSERT INTO public.notifications (recipient_role, recipient_id, order_id, title_ar, title_en, message_ar, message_en)
  VALUES (
    'admin', NULL, NEW.id,
    'تغيير حالة الطلب #' || NEW.order_number,
    'Order #' || NEW.order_number || ' status changed',
    v_name || ' — ' || v_amt || E'\n' || 'الحالة: ' || OLD.status::text || ' ← ' || NEW.status::text,
    v_name || ' — ' || v_amt || E'\n' || 'Status: ' || OLD.status::text || ' -> ' || NEW.status::text
  );

  RETURN NEW;
END; $$;
