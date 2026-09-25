import { supabase } from '../../../lib/supabase';
import { PerformansTelemetri } from '../../../ortak/performans/PerformansTelemetri';

export type MesajLinkOnizleme = {
  title?: string | null;
  description?: string | null;
  image_url?: string | null;
  site_name?: string | null;
  url?: string | null;
};

export type MesajMediaMeta = {
  duration_ms?: number;
  waveform?: number[];
  width?: number;
  height?: number;
  mime?: string;
  music_snapshot?: {
    title?: string;
    cover_url?: string | null;
    artist_name?: string;
    duration_ms?: number | null;
  };
  cleaned?: boolean;
  [key: string]: unknown;
};

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
  reply_to_id?: string | null;
  music_track_id?: string | null;
  view_once?: boolean;
  view_once_opened_at?: string | null;
  view_once_opened_by?: string | null;
  edited_at?: string | null;
  edit_version?: number | null;
  updated_at?: string | null;
  media_meta?: MesajMediaMeta | null;
  link_url?: string | null;
  link_preview?: MesajLinkOnizleme | null;
  created_at: string;
  deleted_at?: string | null;
  /** Optimistic / outbox UI */
  _localStatus?: 'queued' | 'sending' | 'sent' | 'failed';
};

const SELECT_KOLONLAR =
  'id, thread_id, sender_id, body, message_type, media_url, ref_id, client_id, reply_to_id, music_track_id, view_once, view_once_opened_at, view_once_opened_by, edited_at, edit_version, updated_at, media_meta, link_url, link_preview, created_at, deleted_at';

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
      p_limit: input.limit ?? 20,
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
      .select(SELECT_KOLONLAR)
      .eq('thread_id', input.threadId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(input.limit ?? 20);

    if (input.before) q = q.lt('created_at', input.before);

    const fb = await q;
    if (fb.error) throw fb.error;
    return ((fb.data as DirektMesaj[]) ?? []).reverse();
  });
}
