-- Enable RLS on all tables
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_status ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for personal use (no auth required)
-- Settings policies
CREATE POLICY "Allow all operations on settings"
ON public.settings FOR ALL
USING (true)
WITH CHECK (true);

-- Instances policies
CREATE POLICY "Allow all operations on instances"
ON public.instances FOR ALL
USING (true)
WITH CHECK (true);

-- Logs policies
CREATE POLICY "Allow all operations on logs"
ON public.logs FOR ALL
USING (true)
WITH CHECK (true);

-- Media queue policies
CREATE POLICY "Allow all operations on media_queue"
ON public.media_queue FOR ALL
USING (true)
WITH CHECK (true);

-- System status policies
CREATE POLICY "Allow all operations on system_status"
ON public.system_status FOR ALL
USING (true)
WITH CHECK (true);