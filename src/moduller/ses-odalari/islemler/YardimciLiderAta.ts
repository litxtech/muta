import { supabase } from '../../../lib/supabase';

/** Oda sahibi: üye/konuşmacıyı yardımcı lider (cohost) yapar */
export async function YardimciLiderAta(input: {
  roomId: string;
  userId: string;
}): Promise<{ ok: boolean; hata?: string }> {
  const { error } = await supabase.rpc('oda_yardimci_lider_ata', {
    p_room_id: input.roomId,
    p_user_id: input.userId,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}

/** Oda sahibi: yardımcı liderliğini kaldırır → speaker|listener */
export async function YardimciLiderKaldir(input: {
  roomId: string;
  userId: string;
}): Promise<{ ok: boolean; hata?: string }> {
  const { error } = await supabase.rpc('oda_yardimci_lider_kaldir', {
    p_room_id: input.roomId,
    p_user_id: input.userId,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}
