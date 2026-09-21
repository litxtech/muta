import { supabase } from '../../../lib/supabase';

export type OdaBilgiGuncelleGirdi = {
  roomId: string;
  title?: string;
  topic?: string | null;
  coverUrl?: string | null;
  themeCode?: string | null;
};

/**
 * Oda sahibi veya yönetici (cohost): başlık / açıklama / kapak / tema.
 * Başlık: security definer RPC (cohost RLS dışı).
 * Diğer alanlar: host RLS (cover/topic/theme).
 */
export async function OdaBilgileriniGuncelle(
  girdi: OdaBilgiGuncelleGirdi,
): Promise<{ ok: true } | { ok: false; hata: string }> {
  if (girdi.title !== undefined) {
    const t = girdi.title.trim();
    if (!t) return { ok: false, hata: 'Başlık boş olamaz' };
    if (t.length > 40) return { ok: false, hata: 'Başlık en fazla 40 karakter' };
    const { error } = await supabase.rpc('oda_basligini_guncelle', {
      p_room_id: girdi.roomId,
      p_title: t,
    });
    if (error) return { ok: false, hata: error.message };
  }

  const patch: Record<string, string | null> = {};
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
  if (girdi.themeCode !== undefined) {
    const kod = girdi.themeCode?.trim() || null;
    if (kod && kod.length > 40) {
      return { ok: false, hata: 'Tema kodu geçersiz' };
    }
    patch.theme_code = kod;
  }

  if (Object.keys(patch).length === 0) {
    if (girdi.title !== undefined) return { ok: true };
    return { ok: false, hata: 'Güncellenecek alan yok' };
  }

  const { error } = await supabase
    .from('rooms')
    .update(patch)
    .eq('id', girdi.roomId);

  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}
