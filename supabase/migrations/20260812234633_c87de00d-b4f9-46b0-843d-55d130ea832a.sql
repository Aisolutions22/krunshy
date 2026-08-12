REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.notify_sheets_sync() FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.customer_accounts_summary() FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.customer_balance(uuid) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.is_approved_customer() FROM anon, PUBLIC;