-- ============================================================
-- MATURADOR ONLINE — SQL COMPLETO
-- Cole tudo isso no SQL Editor do seu Supabase e execute
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. TABELAS PRINCIPAIS
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.instances (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    instance_name TEXT NOT NULL,
    instance_id TEXT,
    token TEXT,
    status TEXT NOT NULL DEFAULT 'disconnected',
    phone_number TEXT,
    qr_code TEXT,
    messages_sent_today INTEGER NOT NULL DEFAULT 0,
    daily_limit INTEGER NOT NULL DEFAULT 40,
    last_message_date DATE,
    warming_start_date DATE DEFAULT CURRENT_DATE,
    is_warmer_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    from_number TEXT NOT NULL,
    to_number TEXT NOT NULL,
    message_content TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'message',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.media_queue (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    file_url TEXT NOT NULL,
    file_name TEXT,
    caption TEXT,
    posted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.system_status (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    is_active BOOLEAN NOT NULL DEFAULT false,
    interval_minutes INTEGER NOT NULL DEFAULT 5,
    last_execution TIMESTAMP WITH TIME ZONE,
    start_hour INTEGER NOT NULL DEFAULT 8,
    end_hour INTEGER NOT NULL DEFAULT 22,
    min_interval_minutes INTEGER NOT NULL DEFAULT 3,
    max_interval_minutes INTEGER NOT NULL DEFAULT 8,
    enable_bidirectional BOOLEAN NOT NULL DEFAULT true,
    daily_limit_per_chip INTEGER NOT NULL DEFAULT 40,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.messages (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    content TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'geral',
    used_count INTEGER NOT NULL DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 2. TRIGGER DE UPDATED_AT
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_settings_updated_at ON public.settings;
CREATE TRIGGER update_settings_updated_at
    BEFORE UPDATE ON public.settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_instances_updated_at ON public.instances;
CREATE TRIGGER update_instances_updated_at
    BEFORE UPDATE ON public.instances
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_system_status_updated_at ON public.system_status;
CREATE TRIGGER update_system_status_updated_at
    BEFORE UPDATE ON public.system_status
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─────────────────────────────────────────────
-- 3. RLS (Row Level Security) — acesso total (uso pessoal)
-- ─────────────────────────────────────────────

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on settings" ON public.settings;
CREATE POLICY "Allow all on settings" ON public.settings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on instances" ON public.instances;
CREATE POLICY "Allow all on instances" ON public.instances FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on logs" ON public.logs;
CREATE POLICY "Allow all on logs" ON public.logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on media_queue" ON public.media_queue;
CREATE POLICY "Allow all on media_queue" ON public.media_queue FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on system_status" ON public.system_status;
CREATE POLICY "Allow all on system_status" ON public.system_status FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on messages" ON public.messages;
CREATE POLICY "Allow all on messages" ON public.messages FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────
-- 4. REALTIME
-- ─────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- ─────────────────────────────────────────────
-- 5. DADOS INICIAIS
-- ─────────────────────────────────────────────

INSERT INTO public.system_status (is_active, interval_minutes)
SELECT false, 5
WHERE NOT EXISTS (SELECT 1 FROM public.system_status);

INSERT INTO public.messages (content, category) VALUES
('E aí mano, suave? 👊', 'saudacao'),
('Fala aí parceiro, tudo certo?', 'saudacao'),
('Opa, beleza? Quanto tempo!', 'saudacao'),
('Salve! Tá firmeza?', 'saudacao'),
('Iae cara, como tão as coisas?', 'saudacao'),
('E aí chefe, como tá a família?', 'saudacao'),
('Opa, tranquilo por aí?', 'saudacao'),
('Fala meu bom, suave?', 'saudacao'),
('Eae brother, firmeza?', 'saudacao'),
('Salve salve! Tudo na paz?', 'saudacao'),
('E aí amigão, quanto tempo!', 'saudacao'),
('Faaala sumido! Tá vivo ainda? 😂', 'saudacao'),
('Opa, e aí? Cadê vc?', 'saudacao'),
('Fala tu, de boa?', 'saudacao'),
('E aí camarada, beleza?', 'saudacao'),
('Cara, como foi o final de semana?', 'pergunta'),
('Mano, vc viu o jogo ontem?', 'pergunta'),
('E aí, tá trabalhando hoje?', 'pergunta'),
('Opa, conseguiu resolver aquela parada?', 'pergunta'),
('Fala aí, tá fazendo o que hj?', 'pergunta'),
('Mano, que horas começa amanhã?', 'pergunta'),
('Eai, vai sair hj?', 'pergunta'),
('Tá em casa?', 'pergunta'),
('Vc já comeu hj?', 'pergunta'),
('Tá acordado ainda?', 'pergunta'),
('Bora marcar aquele churras?', 'plano'),
('Vamo tomar um café qualquer dia?', 'plano'),
('Mano, bora jogar uma bola amanhã?', 'plano'),
('Passa lá em casa qualquer hora', 'plano'),
('Vambora sair sexta?', 'plano'),
('Bora pedir um lanche?', 'plano'),
('Mano, vou passar aí mais tarde', 'plano'),
('Bora assistir o jogo juntos?', 'plano'),
('Vmo naquele restaurante novo?', 'plano'),
('Bora dar um rolê? Tô entediado kk', 'plano'),
('Kkk lembrei de você agora', 'zoeira'),
('Po mano, saudade!', 'zoeira'),
('Tmj! 💪', 'zoeira'),
('Kkkkk mano vc é doido', 'zoeira'),
('Cara, ri muito com aquilo ontem', 'zoeira'),
('Mano do céu kkkkk', 'zoeira'),
('Vc viu o meme que mandei?', 'zoeira'),
('Hahaha muito bom', 'zoeira'),
('Po cara, não acredito nisso 😂', 'zoeira'),
('Mano, que absurdo kkk', 'zoeira'),
('Bom dia! ☀️', 'horario'),
('Bom dia parceiro!', 'horario'),
('Boa tarde mano!', 'horario'),
('Boa noite! Dorme bem', 'horario'),
('Bom dia, bora trabalhar 💪', 'horario'),
('Boa noite cara, tmj', 'horario'),
('👊', 'emoji'),
('😂😂😂', 'emoji'),
('💪🔥', 'emoji'),
('🤙', 'emoji'),
('👍', 'emoji'),
('😎', 'emoji'),
('Blz', 'resposta'),
('Show', 'resposta'),
('Fechou', 'resposta'),
('Tmj', 'resposta'),
('Valeu!', 'resposta'),
('Beleza', 'resposta'),
('Top', 'resposta'),
('Suave', 'resposta'),
('De boa', 'resposta'),
('Pode crer', 'resposta'),
('Cara, tava pensando aqui, faz tempo que a gente não se vê', 'conversa'),
('Mano, me indica um filme bom aí', 'conversa'),
('Acabei de chegar do trabalho, que dia puxado', 'conversa'),
('Tô aqui sem fazer nada, entediado demais', 'conversa'),
('Cara, preciso de uma dica, me ajuda?', 'conversa'),
('Mano, vc tbm tá achando esse calor absurdo?', 'conversa'),
('Fala aí, me manda a localização do lugar', 'conversa'),
('Cara, tô pensando em trocar de celular', 'conversa'),
('Mano, aquele lugar que vc falou é bom mesmo?', 'conversa'),
('Vc assistiu aquela série? Vale a pena?', 'conversa');

-- ─────────────────────────────────────────────
-- 6. STORAGE (bucket de mídia)
-- ─────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public media access" ON storage.objects;
CREATE POLICY "Public media access" ON storage.objects FOR SELECT USING (bucket_id = 'media');

DROP POLICY IF EXISTS "Allow media uploads" ON storage.objects;
CREATE POLICY "Allow media uploads" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'media');

DROP POLICY IF EXISTS "Allow media deletes" ON storage.objects;
CREATE POLICY "Allow media deletes" ON storage.objects FOR DELETE USING (bucket_id = 'media');

-- ─────────────────────────────────────────────
-- 7. PG_CRON — warmer automático 24/7
-- Preencha SUPABASE_URL e ANON_KEY antes de rodar esta parte
-- ─────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'invoke-warmer-cron') THEN
    PERFORM cron.unschedule('invoke-warmer-cron');
  END IF;
END $$;

SELECT cron.schedule(
  'invoke-warmer-cron',
  '* * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://dados-supabase.rt19gx.easypanel.host/functions/v1/warmer-cron',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer COLE_SEU_ANON_KEY_AQUI"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);
