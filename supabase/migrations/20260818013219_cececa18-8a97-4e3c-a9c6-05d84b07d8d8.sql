CREATE OR REPLACE FUNCTION public.collections_total(_from timestamptz, _to timestamptz)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(o.total), 0)::numeric
  FROM public.orders o
  WHERE public.is_admin()
    AND o.status = 'completed'
    AND o.created_at >= _from
    AND o.created_at <= _to
$$;

REVOKE ALL ON FUNCTION public.collections_total(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.collections_total(timestamptz, timestamptz) TO authenticated, service_role;