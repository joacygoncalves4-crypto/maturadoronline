-- ============================================================
-- ADIÇÃO: Postagem automática de Status
-- Roda no SQL Editor do seu Supabase (pode rodar várias vezes, é idempotente)
-- ============================================================

-- 1. Configurações de status no system_status
ALTER TABLE public.system_status
  ADD COLUMN IF NOT EXISTS enable_status_posting BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status_interval_hours INTEGER NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS last_status_post TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS status_caption_random BOOLEAN NOT NULL DEFAULT true;

-- 2. Tracking por chip — última vez que cada um postou status
ALTER TABLE public.instances
  ADD COLUMN IF NOT EXISTS last_status_post TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS status_posts_today INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_status_date DATE;

-- 3. Adicionar campo de tipo na fila de mídia (imagem/vídeo)
ALTER TABLE public.media_queue
  ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS posted_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_posted_at TIMESTAMP WITH TIME ZONE;
