import { supabase } from '../../../lib/supabase';

/** Oda sahibi seat 0 (taht) üzerinde değilse yeniden oturtur. */
export async function HostTahtaOtur(odaId: string): Promise<{ ok: boolean; hata?: string }> {
  const { error } = await supabase.rpc('host_tahta_otur', { p_room_id: odaId });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}
