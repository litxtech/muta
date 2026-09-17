import { supabase } from '../../../lib/supabase';

/** Ses odası sahibi liderliği başka bir üye/konuşmacıya devreder */
export async function LiderligiDevret(input: {
  roomId: string;
  yeniHostId: string;
}): Promise<{ ok: boolean; hata?: string }> {
  const { error } = await supabase.rpc('oda_liderligi_devret', {
    p_room_id: input.roomId,
    p_yeni_host_id: input.yeniHostId,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}
