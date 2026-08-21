ALTER TABLE public.restaurant_settings
  ADD COLUMN IF NOT EXISTS is_ordering_open boolean NOT NULL DEFAULT true;

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
  v_open BOOLEAN;
BEGIN
  IF _client_token IS NOT NULL THEN
    SELECT id INTO v_existing FROM public.orders WHERE client_token = _client_token;
    IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
  END IF;

  SELECT is_ordering_open INTO v_open FROM public.restaurant_settings LIMIT 1;
  IF COALESCE(v_open, TRUE) = FALSE THEN
    RAISE EXCEPTION 'ORDERING_CLOSED';
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