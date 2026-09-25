import { supabase } from '../../../lib/supabase';

export type MesajSabitKayit = {
  thread_id: string;
  message_id: string;
  pinned_by: string;
  pinned_at: string;
};

export async function MesajSabitle(
  messageId: string,
): Promise<{ ok: true; pin: MesajSabitKayit } | { ok: false; hata: string }> {
  const { data, error } = await supabase.rpc('mesaj_sabitle', {
    p_message_id: messageId,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true, pin: data as MesajSabitKayit };
}

export async function MesajSabitlemeyiKaldir(
  messageId: string,
): Promise<{ ok: boolean; hata?: string }> {
  const { error } = await supabase.rpc('mesaj_sabitlemeyi_kaldir', {
    p_message_id: messageId,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}

export async function MesajSabitlenenleriGetir(
  threadId: string,
): Promise<MesajSabitKayit[]> {
  const { data, error } = await supabase.rpc('mesaj_sabitlenenleri_getir', {
    p_thread_id: threadId,
  });
  if (error) return [];
  return (data as MesajSabitKayit[]) ?? [];
}
