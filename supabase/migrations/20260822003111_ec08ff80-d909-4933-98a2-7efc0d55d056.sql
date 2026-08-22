-- sync_config holds the sheets endpoint URL and sync token (a secret).
-- It must never be reachable from the Data API by anon/authenticated clients.
REVOKE ALL ON public.sync_config FROM anon, authenticated;
GRANT ALL ON public.sync_config TO service_role;

ALTER TABLE public.sync_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_config FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sync_config_no_client_access ON public.sync_config;
CREATE POLICY sync_config_no_client_access
  ON public.sync_config
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);