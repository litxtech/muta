import { supabase } from '../../../lib/supabase';

export async function MikrofonIstegiGonder(odaId: string): Promise<{ ok: boolean; hata?: string }> {
  const { error } = await supabase.rpc('mikrofon_istegi_gonder', { p_room_id: odaId });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}
