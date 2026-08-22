ALTER TABLE public.payments ALTER COLUMN paid_on SET DEFAULT (now() AT TIME ZONE 'Africa/Cairo')::date;
ALTER TABLE public.expenses ALTER COLUMN spent_on SET DEFAULT (now() AT TIME ZONE 'Africa/Cairo')::date;
ALTER TABLE public.account_closings ALTER COLUMN period_end SET DEFAULT (now() AT TIME ZONE 'Africa/Cairo')::date;