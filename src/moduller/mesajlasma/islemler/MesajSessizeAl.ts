import { supabase } from '../../../lib/supabase';

export async function MesajThreadSessizeAl(input: {
  threadId: string;
  minutes?: number | null;
  forever?: boolean;
}): Promise<{ ok: true; mutedUntil: string } | { ok: false; hata: string }> {
  const { data, error } = await supabase.rpc('mesaj_thread_sessize_al', {
    p_thread_id: input.threadId,
    p_minutes: input.forever ? null : (input.minutes ?? null),
    p_forever: input.forever ?? false,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true, mutedUntil: data as string };
}

export async function MesajThreadSessiziAc(
  threadId: string,
): Promise<{ ok: boolean; hata?: string }> {
  const { error } = await supabase.rpc('mesaj_thread_sessizi_ac', {
    p_thread_id: threadId,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}

/** Aktif mute bitiş zamanı; yoksa / süresi dolmuşsa null */
export async function MesajThreadMuteGet(
  threadId: string,
): Promise<string | null> {
  const { data, error } = await supabase.rpc('mesaj_thread_mute_get', {
    p_thread_id: threadId,
  });
  if (error) return null;
  return (data as string | null) ?? null;
}
