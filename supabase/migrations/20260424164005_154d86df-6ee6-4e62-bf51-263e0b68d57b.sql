ALTER TABLE public.instances 
ADD COLUMN IF NOT EXISTS is_warmer_enabled BOOLEAN NOT NULL DEFAULT true;