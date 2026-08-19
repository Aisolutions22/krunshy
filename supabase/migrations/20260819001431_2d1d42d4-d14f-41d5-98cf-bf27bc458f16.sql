CREATE OR REPLACE FUNCTION public.collections_total(_from timestamp with time zone, _to timestamp with time zone)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN public.is_admin() THEN
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