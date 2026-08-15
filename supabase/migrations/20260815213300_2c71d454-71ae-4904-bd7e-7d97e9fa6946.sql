CREATE OR REPLACE FUNCTION public.close_account(_customer_id uuid, _note text DEFAULT NULL)
RETURNS public.account_closings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cutoff timestamptz;
  v_period_start date;
  v_balance numeric;
  v_paid numeric;
  v_row public.account_closings;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admins only'; END IF;
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
END; $$;

REVOKE ALL ON FUNCTION public.close_account(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_account(uuid, text) TO authenticated;