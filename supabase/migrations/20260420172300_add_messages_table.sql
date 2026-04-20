-- Create messages table for the message bank
CREATE TABLE public.messages (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    content TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'geral',
    used_count INTEGER NOT NULL DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS with permissive policy
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on messages"
ON public.messages FOR ALL
USING (true)
WITH CHECK (true);

-- Add daily message tracking columns to instances
ALTER TABLE public.instances 
ADD COLUMN IF NOT EXISTS messages_sent_today INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_limit INTEGER NOT NULL DEFAULT 40,
ADD COLUMN IF NOT EXISTS last_message_date DATE,
ADD COLUMN IF NOT EXISTS warming_start_date DATE DEFAULT CURRENT_DATE;

-- Add more control columns to system_status
ALTER TABLE public.system_status
ADD COLUMN IF NOT EXISTS start_hour INTEGER NOT NULL DEFAULT 8,
ADD COLUMN IF NOT EXISTS end_hour INTEGER NOT NULL DEFAULT 22,
ADD COLUMN IF NOT EXISTS min_interval_minutes INTEGER NOT NULL DEFAULT 3,
ADD COLUMN IF NOT EXISTS max_interval_minutes INTEGER NOT NULL DEFAULT 15,
ADD COLUMN IF NOT EXISTS enable_bidirectional BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS daily_limit_per_chip INTEGER NOT NULL DEFAULT 40;

-- Enable realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Insert some default messages to get started
INSERT INTO public.messages (content, category) VALUES
-- Saudações
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
-- Perguntas casuais
('Cara, como foi o final de semana?', 'pergunta'),
('Mano, vc viu o jogo ontem?', 'pergunta'),
('E aí, tá trabalhando hoje?', 'pergunta'),
('Opa, conseguiu resolver aquela parada?', 'pergunta'),
('Fala aí, tá fazendo o que hj?', 'pergunta'),
('Mano, que horas começa amanhã?', 'pergunta'),
('Eai, vai sair hj?', 'pergunta'),
('Cara, onde vc comprou aquele bagulho?', 'pergunta'),
('Tá em casa?', 'pergunta'),
('Mano, que dia é a festa?', 'pergunta'),
('Vc já comeu hj?', 'pergunta'),
('Tá acordado ainda?', 'pergunta'),
('Cara, vc tem o número do fulano?', 'pergunta'),
('E aí, como tá o trabalho?', 'pergunta'),
('Mano, o que vc vai fazer no feriado?', 'pergunta'),
-- Planos e convites
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
-- Comentários e zoeiras
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
-- Bom dia / Boa noite
('Bom dia! ☀️', 'horario'),
('Bom dia parceiro!', 'horario'),
('Boa tarde mano!', 'horario'),
('Boa noite! Dorme bem', 'horario'),
('Bom dia, bora trabalhar 💪', 'horario'),
('Boa noite cara, tmj', 'horario'),
-- Figurinhas / Emojis
('👊', 'emoji'),
('😂😂😂', 'emoji'),
('💪🔥', 'emoji'),
('🤙', 'emoji'),
('👍', 'emoji'),
('😎', 'emoji'),
-- Respostas curtas
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
-- Mensagens mais longas / naturais
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
