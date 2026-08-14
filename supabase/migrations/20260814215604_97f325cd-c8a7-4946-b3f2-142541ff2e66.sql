SELECT cron.unschedule('daily-closing-cairo') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-closing-cairo');
SELECT cron.unschedule('daily-closing-cairo-a') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-closing-cairo-a');
SELECT cron.unschedule('daily-closing-cairo-b') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-closing-cairo-b');

-- Run at both 21:00 and 22:00 UTC, but only act when it is actually midnight in Cairo.
-- This stays correct across Egypt's DST changes (UTC+2 winter / UTC+3 summer).
SELECT cron.schedule('daily-closing-cairo-a', '0 21 * * *', $$SELECT public.run_daily_closing() WHERE to_char(now() AT TIME ZONE 'Africa/Cairo', 'HH24') = '00';$$);
SELECT cron.schedule('daily-closing-cairo-b', '0 22 * * *', $$SELECT public.run_daily_closing() WHERE to_char(now() AT TIME ZONE 'Africa/Cairo', 'HH24') = '00';$$);