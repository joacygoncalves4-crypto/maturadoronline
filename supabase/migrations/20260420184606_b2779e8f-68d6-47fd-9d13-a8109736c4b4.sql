
-- Add missing columns to instances
ALTER TABLE public.instances
  ADD COLUMN IF NOT EXISTS messages_sent_today integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_limit integer NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS last_message_date date,
  ADD COLUMN IF NOT EXISTS warming_start_date date DEFAULT CURRENT_DATE;

-- Add missing columns to system_status
ALTER TABLE public.system_status
  ADD COLUMN IF NOT EXISTS start_hour integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS end_hour integer NOT NULL DEFAULT 22,
  ADD COLUMN IF NOT EXISTS min_interval_minutes integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS max_interval_minutes integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS enable_bidirectional boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS daily_limit_per_chip integer NOT NULL DEFAULT 40;

-- Create messages table (message bank)
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  category text NOT NULL DEFAULT 'geral',
  used_count integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on messages" ON public.messages;
CREATE POLICY "Allow all operations on messages" ON public.messages
  FOR ALL USING (true) WITH CHECK (true);

-- Enable pg_cron and pg_net so the warmer runs 24/7 without the browser
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
