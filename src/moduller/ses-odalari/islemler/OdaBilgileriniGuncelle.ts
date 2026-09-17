import { supabase } from '../../../lib/supabase';

export type OdaBilgiGuncelleGirdi = {
  roomId: string;
  title?: string;
  topic?: string | null;
  coverUrl?: string | null;
};

/**
 * Oda sahibi: başlık / açıklama / kapak günceller.
 * RLS: Hosts update own rooms.
 */
export async function OdaBilgileriniGuncelle(
  girdi: OdaBilgiGuncelleGirdi,
): Promise<{ ok: true } | { ok: false; hata: string }> {
  const patch: Record<string, string | null> = {};
  if (girdi.title !== undefined) {
    const t = girdi.title.trim();
    if (!t) return { ok: false, hata: 'Başlık boş olamaz' };
    if (t.length > 40) return { ok: false, hata: 'Başlık en fazla 40 karakter' };
    patch.title = t;
  }
  if (girdi.topic !== undefined) {
    const topic = girdi.topic?.trim() || null;
    if (topic && topic.length > 120) {
      return { ok: false, hata: 'Açıklama en fazla 120 karakter' };
    }
    patch.topic = topic;
  }
  if (girdi.coverUrl !== undefined) {
    patch.cover_url = girdi.coverUrl;
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, hata: 'Güncellenecek alan yok' };
  }

  const { error } = await supabase
    .from('rooms')
    .update(patch)
    .eq('id', girdi.roomId);

  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}
