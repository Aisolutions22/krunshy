CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE public.sync_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  endpoint_url text NOT NULL,
  sync_token text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.sync_config TO service_role;
ALTER TABLE public.sync_config ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid,
  status text NOT NULL DEFAULT 'failed',
  error_message text,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  retry_count integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.sync_logs TO authenticated;
GRANT ALL ON public.sync_logs TO service_role;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY sync_logs_admin_select ON public.sync_logs FOR SELECT TO authenticated USING (public.is_admin());
CREATE INDEX sync_logs_attempted_at_idx ON public.sync_logs (attempted_at DESC);
CREATE UNIQUE INDEX sync_logs_unique_record ON public.sync_logs (table_name, record_id);

INSERT INTO public.sync_config (endpoint_url, sync_token)
VALUES ('https://project--1ba71549-6919-485c-b802-dad045d9ebc3.lovable.app/api/public/sync-sheets',
        '7fb9d4d8a6fba4f9f3b3b6bb0a784c3c8077d63fde1454670647bc0a58c54cbf');

CREATE OR REPLACE FUNCTION public.notify_sheets_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE cfg public.sync_config%ROWTYPE;
BEGIN
  SELECT * INTO cfg FROM public.sync_config LIMIT 1;
  IF cfg.id IS NULL THEN RETURN NEW; END IF;
  PERFORM net.http_post(
    url := cfg.endpoint_url,
    headers := jsonb_build_object('content-type', 'application/json', 'x-sync-token', cfg.sync_token),
    body := jsonb_build_object('table', TG_TABLE_NAME, 'record_id', NEW.id),
    timeout_milliseconds := 5000
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END; $$;

CREATE TRIGGER orders_sheets_sync AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_sheets_sync();
CREATE TRIGGER order_items_sheets_sync AFTER INSERT OR UPDATE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.notify_sheets_sync();
CREATE TRIGGER payments_sheets_sync AFTER INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.notify_sheets_sync();
CREATE TRIGGER expenses_sheets_sync AFTER INSERT OR UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.notify_sheets_sync();
CREATE TRIGGER account_closings_sheets_sync AFTER INSERT OR UPDATE ON public.account_closings
  FOR EACH ROW EXECUTE FUNCTION public.notify_sheets_sync();
CREATE TRIGGER profiles_sheets_sync AFTER INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.notify_sheets_sync();