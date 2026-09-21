import { supabase } from '../../../lib/supabase';

/**
 * Konuşmacı koltuğundan ayrıl → dinleyici kal (odadan çıkma).
 * is_mic_locked olsa bile çalışır — sunucu tarafında engellenmez.
 */
export async function KoltuktanAyril(
  roomId: string,
): Promise<{ ok: boolean; hata?: string }> {
  const { error } = await supabase.rpc('koltuktan_ayril', {
    p_room_id: roomId,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}
