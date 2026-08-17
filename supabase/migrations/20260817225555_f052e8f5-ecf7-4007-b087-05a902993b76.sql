DROP POLICY IF EXISTS "audit_insert_self" ON public.audit_logs;
REVOKE INSERT ON public.audit_logs FROM authenticated;

CREATE OR REPLACE FUNCTION public.log_audit(
  _action text,
  _entity text,
  _entity_id uuid DEFAULT NULL,
  _previous_value jsonb DEFAULT NULL,
  _new_value jsonb DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF _action IS NULL OR _entity IS NULL OR length(_action) > 64 OR length(_entity) > 64 THEN
    RAISE EXCEPTION 'invalid audit payload';
  END IF;
  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, previous_value, new_value)
  VALUES (auth.uid(), _action, _entity, _entity_id, _previous_value, _new_value);
END;
$$;

REVOKE ALL ON FUNCTION public.log_audit(text, text, uuid, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_audit(text, text, uuid, jsonb, jsonb) TO authenticated;