import { supabase } from '../../../lib/supabase';

export type MesajKonusu = {
  id: string;
  updated_at: string;
  last_message_at: string | null;
  last_message_preview: string | null;
};

export async function MesajKonulariniGetir(): Promise<MesajKonusu[]> {
  const { data: uyelikler, error: e1 } = await supabase
    .from('message_thread_members')
    .select('thread_id');
  if (e1) throw e1;
  const ids = (uyelikler ?? []).map((u) => u.thread_id);
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from('message_threads')
    .select('id, updated_at, last_message_at, last_message_preview')
    .in('id', ids)
    .order('last_message_at', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data as MesajKonusu[]) ?? [];
}
