CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE IF NOT EXISTS public.sheet_sync_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_key text NOT NULL UNIQUE,
  tab text NOT NULL,
  row_number integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.sheet_sync_state TO service_role;

ALTER TABLE public.sheet_sync_state ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS sheet_sync_state_updated_at ON public.sheet_sync_state;
CREATE TRIGGER sheet_sync_state_updated_at
BEFORE UPDATE ON public.sheet_sync_state
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.run_daily_closing()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE cfg public.sync_config%ROWTYPE;
BEGIN
  SELECT * INTO cfg FROM public.sync_config LIMIT 1;
  IF cfg.id IS NULL THEN RETURN; END IF;
  PERFORM net.http_post(
    url := replace(cfg.endpoint_url, 'sync-sheets', 'daily-closing'),
    headers := jsonb_build_object('content-type', 'application/json', 'x-sync-token', cfg.sync_token),
    body := jsonb_build_object('date', to_char((now() AT TIME ZONE 'Africa/Cairo')::date - 1, 'YYYY-MM-DD')),
    timeout_milliseconds := 10000
  );
END; $$;

REVOKE EXECUTE ON FUNCTION public.run_daily_closing() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('daily-closing-cairo') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-closing-cairo');

SELECT cron.schedule('daily-closing-cairo', '0 21 * * *', $$SELECT public.run_daily_closing();$$);