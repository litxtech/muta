import { supabase } from '../../../lib/supabase';

/**
 * Ev sahibi odayı kapatır — is_live=false → feed anında düşer.
 */
export async function OdayiSil(odaId: string): Promise<{ ok: true } | { ok: false; hata: string }> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return { ok: false, hata: 'Oturum gerekli' };

  const { data, error } = await supabase
    .from('rooms')
    .update({
      is_live: false,
      ended_at: new Date().toISOString(),
    })
    .eq('id', odaId)
    .eq('host_id', uid)
    .select('id')
    .maybeSingle();

  if (error) return { ok: false, hata: error.message };
  if (!data) return { ok: false, hata: 'Oda silinemedi veya yetkin yok' };
  return { ok: true };
}
