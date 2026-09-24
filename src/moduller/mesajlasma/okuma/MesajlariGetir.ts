import { supabase } from '../../../lib/supabase';
import { PerformansTelemetri } from '../../../ortak/performans/PerformansTelemetri';

export type DirektMesaj = {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string | null;
  message_type: string;
  media_url?: string | null;
  /** shared_post → status_posts.id */
  ref_id?: string | null;
  client_id?: string | null;
  created_at: string;
  deleted_at?: string | null;
  /** Optimistic UI */
  _localStatus?: 'sending' | 'failed' | 'sent';
};

export async function MesajThreadEngelliMi(threadId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('mesaj_thread_engelli_mi', {
    p_thread_id: threadId,
  });
  if (error) return false;
  return !!data;
}

export async function MesajlariGetir(input: {
  threadId: string;
  limit?: number;
  before?: string;
}): Promise<DirektMesaj[]> {
  return PerformansTelemetri.olc('MesajlariGetir', async () => {
    const { data, error } = await supabase.rpc('mesajlari_getir', {
      p_thread_id: input.threadId,
      p_limit: input.limit ?? 50,
      p_before: input.before ?? null,
    });

    if (!error && data) {
      return ((data as DirektMesaj[]) ?? []).reverse();
    }

    // Engelli iletişim — fallback ile geçmiş açma
    const msg = (error?.message ?? '').toLowerCase();
    if (msg.includes('engellen') || msg.includes('blocked')) {
      throw new Error('Bu kullaniciyla iletisim engellenmis');
    }

    let q = supabase
      .from('direct_messages')
      .select(
        'id, thread_id, sender_id, body, message_type, media_url, ref_id, client_id, created_at, deleted_at',
      )
      .eq('thread_id', input.threadId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(input.limit ?? 50);

    if (input.before) q = q.lt('created_at', input.before);

    const fb = await q;
    if (fb.error) throw fb.error;
    return ((fb.data as DirektMesaj[]) ?? []).reverse();
  });
}
