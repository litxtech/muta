import { supabase } from '../../../lib/supabase';
import { OzellikBayragiAktifMiSunucu } from '../../ozellik-bayraklari/okuma/OzellikBayragiAktifMiSunucu';

export async function MesajGonder(input: {
  threadId: string;
  body: string;
}): Promise<{ ok: boolean; hata?: string }> {
  if (!(await OzellikBayragiAktifMiSunucu('messages_enabled'))) {
    return { ok: false, hata: 'Mesajlasma kapali.' };
  }
  const { error } = await supabase.rpc('mesaj_gonder', {
    p_thread_id: input.threadId,
    p_body: input.body,
    p_message_type: 'text',
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}

export async function OzelSohbetAcVeyaGetir(
  otherUserId: string,
): Promise<{ ok: true; threadId: string } | { ok: false; hata: string }> {
  const { data, error } = await supabase.rpc('ozel_sohbet_ac_veya_getir', {
    p_other_user_id: otherUserId,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true, threadId: data as string };
}
