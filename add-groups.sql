-- ============================================================
-- ADIÇÃO: Grupos de Maturação
-- Roda no SQL Editor do seu Supabase (idempotente)
-- ============================================================

-- 1. Tabela de grupos
CREATE TABLE IF NOT EXISTS public.groups (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    group_jid TEXT NOT NULL UNIQUE,           -- WhatsApp group ID (ex: 123456789@g.us)
    name TEXT NOT NULL,
    invite_link TEXT,                          -- link de convite original
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,   -- se o grupo deve ser usado pra maturação
    messages_sent_count INTEGER NOT NULL DEFAULT 0,
    last_message_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Tabela de relação chip <-> grupo (quais chips estão em quais grupos)
CREATE TABLE IF NOT EXISTS public.group_members (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    is_admin BOOLEAN NOT NULL DEFAULT false,
    UNIQUE(group_id, instance_id)
);

-- 3. RLS
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on groups" ON public.groups;
CREATE POLICY "Allow all on groups" ON public.groups FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on group_members" ON public.group_members;
CREATE POLICY "Allow all on group_members" ON public.group_members FOR ALL USING (true) WITH CHECK (true);

-- 4. Trigger de updated_at
DROP TRIGGER IF EXISTS update_groups_updated_at ON public.groups;
CREATE TRIGGER update_groups_updated_at
    BEFORE UPDATE ON public.groups
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Configurações de grupo no system_status
ALTER TABLE public.system_status
  ADD COLUMN IF NOT EXISTS enable_group_messages BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS group_message_ratio INTEGER NOT NULL DEFAULT 30; -- % do tráfego que vai pra grupo (0-100)

-- 6. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;
