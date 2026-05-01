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
  messages_sent_today: number;
  daily_limit: number;
  last_message_date: string | null;
  warming_start_date: string | null;
  is_warmer_enabled: boolean;
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
    .insert({ instance_name: name, warming_start_date: new Date().toISOString().split('T')[0] })
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
  start_hour: number;
  end_hour: number;
  min_interval_minutes: number;
  max_interval_minutes: number;
  enable_bidirectional: boolean;
  daily_limit_per_chip: number;
  enable_status_posting: boolean;
  status_interval_hours: number;
  last_status_post: string | null;
  status_caption_random: boolean;
  enable_group_messages: boolean;
  group_message_ratio: number;
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

// Messages helpers (NEW - Message Bank)
export interface Message {
  id: string;
  content: string;
  category: string;
  used_count: number;
  last_used_at: string | null;
  is_active: boolean;
  created_at: string;
}

export async function getMessages(): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error || !data) return [];
  return data;
}

export async function getActiveMessages(): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('is_active', true)
    .order('used_count', { ascending: true });
  
  if (error || !data) return [];
  return data;
}

export async function addMessage(content: string, category: string = 'geral'): Promise<Message | null> {
  const { data, error } = await supabase
    .from('messages')
    .insert({ content, category })
    .select()
    .single();
  
  if (error || !data) return null;
  return data;
}

export async function addMessagesBulk(messages: { content: string; category: string }[]): Promise<number> {
  const { data, error } = await supabase
    .from('messages')
    .insert(messages)
    .select();
  
  if (error || !data) return 0;
  return data.length;
}

export async function deleteMessage(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('id', id);
  
  return !error;
}

export async function deleteAllMessages(): Promise<boolean> {
  const { error } = await supabase
    .from('messages')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
  
  return !error;
}

export async function toggleMessage(id: string, isActive: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('messages')
    .update({ is_active: isActive })
    .eq('id', id);
  
  return !error;
}

export async function getMessageStats(): Promise<{ total: number; active: number; categories: Record<string, number> }> {
  const messages = await getMessages();
  const active = messages.filter(m => m.is_active).length;
  const categories: Record<string, number> = {};
  messages.forEach(m => {
    categories[m.category] = (categories[m.category] || 0) + 1;
  });
  return { total: messages.length, active, categories };
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

// ─── GRUPOS DE MATURAÇÃO ──────────────────────────
export interface Group {
  id: string;
  group_jid: string;
  name: string;
  invite_link: string | null;
  description: string | null;
  is_active: boolean;
  messages_sent_count: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  instance_id: string;
  joined_at: string;
  is_admin: boolean;
}

export async function getGroups(): Promise<Group[]> {
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data;
}

export async function createGroup(group: Partial<Group>): Promise<Group | null> {
  const { data, error } = await supabase
    .from('groups')
    .insert(group)
    .select()
    .single();
  if (error || !data) return null;
  return data;
}

export async function updateGroup(id: string, updates: Partial<Group>): Promise<boolean> {
  const { error } = await supabase.from('groups').update(updates).eq('id', id);
  return !error;
}

export async function deleteGroup(id: string): Promise<boolean> {
  const { error } = await supabase.from('groups').delete().eq('id', id);
  return !error;
}

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('*')
    .eq('group_id', groupId);
  if (error || !data) return [];
  return data;
}

export async function addGroupMember(groupId: string, instanceId: string): Promise<boolean> {
  const { error } = await supabase
    .from('group_members')
    .insert({ group_id: groupId, instance_id: instanceId });
  return !error;
}

export async function removeGroupMember(groupId: string, instanceId: string): Promise<boolean> {
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('instance_id', instanceId);
  return !error;
}
