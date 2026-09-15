import { supabase } from '../../../lib/supabase';

export async function OdaSohbetMesajiGonder(input: {
  roomId: string;
  body: string;
}): Promise<{ ok: boolean; hata?: string }> {
  const text = input.body.trim();
  if (!text) return { ok: false, hata: 'Mesaj boş olamaz.' };
  if (text.length > 500) return { ok: false, hata: 'Mesaj çok uzun.' };

  const { error } = await supabase.rpc('oda_sohbet_mesaji_gonder', {
    p_room_id: input.roomId,
    p_body: text,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}
