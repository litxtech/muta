import { supabase } from '../../../lib/supabase';

export type MesajViewOnceSonuc =
  | {
      state: 'AVAILABLE' | 'OPENING';
      media_url?: string | null;
      message_type?: string;
      is_sender?: boolean;
      opened_at?: string;
    }
  | {
      state: 'CONSUMED' | 'UNAVAILABLE';
      opened_at?: string;
      opened_by?: string;
      is_sender?: boolean;
    };

export async function MesajViewOnceAc(
  messageId: string,
): Promise<
  | { ok: true; sonuc: MesajViewOnceSonuc }
  | { ok: false; hata: string }
> {
  const { data, error } = await supabase.rpc('mesaj_view_once_ac', {
    p_message_id: messageId,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true, sonuc: data as MesajViewOnceSonuc };
}
