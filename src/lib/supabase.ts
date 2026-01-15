import { supabase } from "@/integrations/supabase/client";

// Settings helpers
export async function getSetting(key: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', key)
    .single();
  
  if (error || !data) return null;
  return data.value;
}

export async function setSetting(key: string, value: string): Promise<boolean> {
  const { error } = await supabase
    .from('settings')
    .upsert({ key, value }, { onConflict: 'key' });
  
  return !error;
}

export async function getSettings(): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('settings')
    .select('key, value');
  
  if (error || !data) return {};
  
  return data.reduce((acc, { key, value }) => {
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);
}

// Instance helpers
export interface Instance {
  id: string;
  instance_name: string;
  instance_id: string | null;
  token: string | null;
  status: string;
  phone_number: string | null;
  qr_code: string | null;
  created_at: string;
  updated_at: string;
}

export async function getInstances(): Promise<Instance[]> {
  const { data, error } = await supabase
    .from('instances')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error || !data) return [];
  return data;
}

export async function createInstance(name: string): Promise<Instance | null> {
  const { data, error } = await supabase
    .from('instances')
    .insert({ instance_name: name })
    .select()
    .single();
  
  if (error || !data) return null;
  return data;
}

export async function updateInstance(id: string, updates: Partial<Instance>): Promise<boolean> {
  const { error } = await supabase
    .from('instances')
    .update(updates)
    .eq('id', id);
  
  return !error;
}

export async function deleteInstance(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('instances')
    .delete()
    .eq('id', id);
  
  return !error;
}

// Logs helpers
export interface LogEntry {
  id: string;
  from_number: string;
  to_number: string;
  message_content: string;
  type: string;
  created_at: string;
}

export async function getLogs(limit = 100): Promise<LogEntry[]> {
  const { data, error } = await supabase
    .from('logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error || !data) return [];
  return data;
}

export async function createLog(log: Omit<LogEntry, 'id' | 'created_at'>): Promise<LogEntry | null> {
  const { data, error } = await supabase
    .from('logs')
    .insert(log)
    .select()
    .single();
  
  if (error || !data) return null;
  return data;
}

// System status helpers
export interface SystemStatus {
  id: string;
  is_active: boolean;
  interval_minutes: number;
  last_execution: string | null;
  updated_at: string;
}

export async function getSystemStatus(): Promise<SystemStatus | null> {
  const { data, error } = await supabase
    .from('system_status')
    .select('*')
    .single();
  
  if (error || !data) return null;
  return data;
}

export async function updateSystemStatus(updates: Partial<SystemStatus>): Promise<boolean> {
  const { data: existing } = await supabase
    .from('system_status')
    .select('id')
    .single();
  
  if (!existing) return false;
  
  const { error } = await supabase
    .from('system_status')
    .update(updates)
    .eq('id', existing.id);
  
  return !error;
}

// Media queue helpers
export interface MediaItem {
  id: string;
  file_url: string;
  file_name: string | null;
  caption: string | null;
  posted: boolean;
  created_at: string;
}

export async function getMediaQueue(): Promise<MediaItem[]> {
  const { data, error } = await supabase
    .from('media_queue')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error || !data) return [];
  return data;
}

export async function addMedia(fileUrl: string, fileName: string): Promise<MediaItem | null> {
  const { data, error } = await supabase
    .from('media_queue')
    .insert({ file_url: fileUrl, file_name: fileName })
    .select()
    .single();
  
  if (error || !data) return null;
  return data;
}

export async function updateMedia(id: string, updates: Partial<MediaItem>): Promise<boolean> {
  const { error } = await supabase
    .from('media_queue')
    .update(updates)
    .eq('id', id);
  
  return !error;
}

export async function deleteMedia(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('media_queue')
    .delete()
    .eq('id', id);
  
  return !error;
}

// Storage helpers
export async function uploadMedia(file: File): Promise<string | null> {
  const fileName = `${Date.now()}-${file.name}`;
  
  const { data, error } = await supabase.storage
    .from('media')
    .upload(fileName, file);
  
  if (error || !data) return null;
  
  const { data: urlData } = supabase.storage
    .from('media')
    .getPublicUrl(fileName);
  
  return urlData.publicUrl;
}
