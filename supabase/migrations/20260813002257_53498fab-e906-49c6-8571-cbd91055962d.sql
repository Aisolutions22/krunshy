DROP TRIGGER IF EXISTS audit_logs_sheets_sync ON public.audit_logs;
CREATE TRIGGER audit_logs_sheets_sync
AFTER INSERT OR UPDATE ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.notify_sheets_sync();