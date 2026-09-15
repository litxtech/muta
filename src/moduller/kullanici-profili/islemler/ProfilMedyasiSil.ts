import { supabase } from '../../../lib/supabase';
import type { ProfilMedyaTuru } from './ProfilMedyasiYukle';

/**
 * profiles.avatar_url / cover_url alanını temizler.
 */
export async function ProfilMedyasiSil(
  tur: ProfilMedyaTuru,
): Promise<{ ok: true } | { ok: false; hata: string }> {
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid) return { ok: false, hata: 'Oturum yok' };

  const column = tur === 'avatar' ? 'avatar_url' : 'cover_url';
  const { error } = await supabase
    .from('profiles')
    .update({ [column]: null })
    .eq('id', uid);

  if (error) {
    return {
      ok: false,
      hata:
        column === 'cover_url' && error.message.includes('cover_url')
          ? 'Kapak alanı henüz yok (migration 016).'
          : error.message,
    };
  }

  return { ok: true };
}
