-- Create settings table for global configuration
CREATE TABLE public.settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create instances table for WhatsApp instances
CREATE TABLE public.instances (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    instance_name TEXT NOT NULL,
    instance_id TEXT,
    token TEXT,
    status TEXT NOT NULL DEFAULT 'disconnected',
    phone_number TEXT,
    qr_code TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create logs table for message history
CREATE TABLE public.logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    from_number TEXT NOT NULL,
    to_number TEXT NOT NULL,
    message_content TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'message',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create media_queue table for status images
CREATE TABLE public.media_queue (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    file_url TEXT NOT NULL,
    file_name TEXT,
    caption TEXT,
    posted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create system_status table for warmer control
CREATE TABLE public.system_status (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    is_active BOOLEAN NOT NULL DEFAULT false,
    interval_minutes INTEGER NOT NULL DEFAULT 5,
    last_execution TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_settings_updated_at
    BEFORE UPDATE ON public.settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_instances_updated_at
    BEFORE UPDATE ON public.instances
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_system_status_updated_at
    BEFORE UPDATE ON public.system_status
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for logs table
ALTER PUBLICATION supabase_realtime ADD TABLE public.logs;

-- Insert default system status
INSERT INTO public.system_status (is_active, interval_minutes) VALUES (false, 5);

-- Create storage bucket for media
INSERT INTO storage.buckets (id, name, public) VALUES ('media', 'media', true);

-- Create storage policy for public access
CREATE POLICY "Public media access"
ON storage.objects FOR SELECT
USING (bucket_id = 'media');

CREATE POLICY "Allow media uploads"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'media');

CREATE POLICY "Allow media deletes"
ON storage.objects FOR DELETE
USING (bucket_id = 'media');