-- Enable required extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove existing job if it already exists (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'invoke-warmer-cron') THEN
    PERFORM cron.unschedule('invoke-warmer-cron');
  END IF;
END $$;

-- Schedule warmer-cron edge function to run every 1 minute (24/7).
-- The edge function itself manages the interval gate (interval_minutes in system_status),
-- so calling it every minute is safe — it simply returns "interval_not_reached" when
-- the configured wait has not elapsed yet.
SELECT cron.schedule(
  'invoke-warmer-cron',
  '* * * * *',
  $$
  SELECT
    net.http_post(
      url     := 'https://htshmcvuwxxmlvkifpex.supabase.co/functions/v1/warmer-cron',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0c2htY3Z1d3h4bWx2a2lmcGV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1MDAzMjQsImV4cCI6MjA4NDA3NjMyNH0.ZUCrgMScECMuccgWt5q6sNwKPi3hEaUd_EkT7fSAIkE"}'::jsonb,
      body    := '{}'::jsonb
    ) AS request_id;
  $$
);
