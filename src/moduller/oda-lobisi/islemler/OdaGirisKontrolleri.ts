import { supabase } from '../../../lib/supabase';
import type { Room } from '../../../types/models';

export async function OdaGirisYetkisiniKontrolEt(odaId: string): Promise<{
  ok: boolean;
  hata?: string;
  oda?: Room;
}> {
  const { data, error } = await supabase
    .from('rooms')
    .select('*, host:profiles!rooms_host_id_fkey(id, display_name, username, avatar_url, level)')
    .eq('id', odaId)
    .maybeSingle();
  if (error) {
    // FK adı farklı ortamlarda olabilir — düz select'e düş
    const yedek = await supabase.from('rooms').select('*').eq('id', odaId).maybeSingle();
    if (yedek.error) return { ok: false, hata: yedek.error.message };
    if (!yedek.data) return { ok: false, hata: 'Oda bulunamadi' };
    if (!yedek.data.is_live) return { ok: false, hata: 'Oda kapali' };
    return { ok: true, oda: yedek.data as Room };
  }
  if (!data) return { ok: false, hata: 'Oda bulunamadi' };
  if (!data.is_live) return { ok: false, hata: 'Oda kapali' };
  return { ok: true, oda: data as Room };
}

export async function OdaKapasitesiniKontrolEt(oda: {
  listener_count: number;
  audience_capacity?: number | null;
}): Promise<{ ok: boolean; hata?: string }> {
  const max = oda.audience_capacity ?? 250;
  if (oda.listener_count >= max) {
    return { ok: false, hata: 'Oda dolu' };
  }
  return { ok: true };
}
