import { supabase } from '../../../lib/supabase';

export type DirektMesaj = {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string | null;
  message_type: string;
  created_at: string;
};

/** Cursor pagination — buyuk listeleri tek seferde indirme */
export async function MesajlariGetir(input: {
  threadId: string;
  limit?: number;
  before?: string;
}): Promise<DirektMesaj[]> {
  let q = supabase
    .from('direct_messages')
    .select('id, thread_id, sender_id, body, message_type, created_at')
    .eq('thread_id', input.threadId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(input.limit ?? 30);

  if (input.before) {
    q = q.lt('created_at', input.before);
  }

  const { data, error } = await q;
  if (error) throw error;
  return ((data as DirektMesaj[]) ?? []).reverse();
}
