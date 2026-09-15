import { supabase } from '../../../lib/supabase';
import { OzellikBayragiAktifMiSunucu } from '../../ozellik-bayraklari/okuma/OzellikBayragiAktifMiSunucu';
import type { DirektMesaj } from '../okuma/MesajlariGetir';

export async function MesajGonder(input: {
  threadId: string;
  body?: string;
  messageType?: 'text' | 'image' | 'video' | 'voice';
  mediaUrl?: string | null;
  clientId?: string;
}): Promise<
  | { ok: true; mesaj: DirektMesaj }
  | { ok: false; hata: string }
> {
  if (!(await OzellikBayragiAktifMiSunucu('messages_enabled'))) {
    return { ok: false, hata: 'Mesajlaşma kapalı.' };
  }

  const { data, error } = await supabase.rpc('mesaj_gonder', {
    p_thread_id: input.threadId,
    p_body: input.body ?? '',
    p_message_type: input.messageType ?? 'text',
    p_media_url: input.mediaUrl ?? null,
    p_client_id: input.clientId ?? null,
  });

  if (error) return { ok: false, hata: error.message };
  return { ok: true, mesaj: data as DirektMesaj };
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

export async function MesajThreadOkundu(threadId: string): Promise<void> {
  await supabase.rpc('mesaj_thread_okundu', { p_thread_id: threadId });
}

export async function MesajThreadArsivle(
  threadId: string,
  arsiv = true,
): Promise<{ ok: boolean; hata?: string }> {
  const { error } = await supabase.rpc('mesaj_thread_arsivle', {
    p_thread_id: threadId,
    p_arsiv: arsiv,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}

/** Sohbeti benden tamamen sil (liste + gecmis). Karsi tarafi etkilemez. */
export async function MesajSohbetSil(
  threadId: string,
): Promise<{ ok: boolean; hata?: string }> {
  const { error } = await supabase.rpc('mesaj_sohbet_sil', {
    p_thread_id: threadId,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}

export async function MesajSil(
  messageId: string,
  kapsam: 'me' | 'everyone' = 'me',
): Promise<{ ok: boolean; hata?: string }> {
  const { error } = await supabase.rpc('mesaj_sil', {
    p_message_id: messageId,
    p_kapsam: kapsam,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}
