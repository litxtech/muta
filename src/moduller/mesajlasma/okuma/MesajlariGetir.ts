import { supabase } from '../../../lib/supabase';

export type DirektMesaj = {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string | null;
  message_type: string;
  media_url?: string | null;
  client_id?: string | null;
  created_at: string;
  deleted_at?: string | null;
  /** Optimistic UI */
  _localStatus?: 'sending' | 'failed' | 'sent';
};

export async function MesajlariGetir(input: {
  threadId: string;
  limit?: number;
  before?: string;
}): Promise<DirektMesaj[]> {
  const { data, error } = await supabase.rpc('mesajlari_getir', {
    p_thread_id: input.threadId,
    p_limit: input.limit ?? 50,
    p_before: input.before ?? null,
  });

  if (!error && data) {
    return ((data as DirektMesaj[]) ?? []).reverse();
  }

  let q = supabase
    .from('direct_messages')
    .select(
      'id, thread_id, sender_id, body, message_type, media_url, client_id, created_at, deleted_at',
    )
    .eq('thread_id', input.threadId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(input.limit ?? 50);

  if (input.before) q = q.lt('created_at', input.before);

  const fb = await q;
  if (fb.error) throw fb.error;
  return ((fb.data as DirektMesaj[]) ?? []).reverse();
}
