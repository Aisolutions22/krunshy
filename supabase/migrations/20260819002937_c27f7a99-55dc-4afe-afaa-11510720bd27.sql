CREATE OR REPLACE FUNCTION public.on_order_created_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (recipient_role, recipient_id, order_id, title_ar, title_en, message_ar, message_en)
  VALUES (
    'admin',
    NULL,
    NEW.id,
    'طلب جديد #' || NEW.order_number,
    'New order #' || NEW.order_number,
    CASE WHEN NEW.order_type = 'CASH' THEN 'طلب كاش' ELSE 'طلب آجل' END
      || ' بقيمة ' || to_char(NEW.total, 'FM999999990.00')
      || COALESCE(' — ' || NULLIF(NEW.visitor_name, ''), ''),
    CASE WHEN NEW.order_type = 'CASH' THEN 'Cash order' ELSE 'Account order' END
      || ' for ' || to_char(NEW.total, 'FM999999990.00')
      || COALESCE(' — ' || NULLIF(NEW.visitor_name, ''), '')
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.on_order_created_notify() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS orders_created_notify ON public.orders;
CREATE TRIGGER orders_created_notify
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.on_order_created_notify();