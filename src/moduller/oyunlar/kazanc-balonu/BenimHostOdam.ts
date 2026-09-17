import { supabase } from '../../../lib/supabase';

export async function BenimHostOdamGetir(): Promise<{
  ok: boolean;
  roomId?: string;
  title?: string;
  isLive?: boolean;
  hata?: string;
}> {
  const { data, error } = await supabase.rpc('benim_host_odam');
  if (error) return { ok: false, hata: error.message };
  const row = data as {
    ok?: boolean;
    room_id?: string;
    title?: string;
    is_live?: boolean;
    hata?: string;
  } | null;
  if (!row?.ok || !row.room_id) {
    return { ok: false, hata: row?.hata ?? 'Kendi odan bulunamadı' };
  }
  return {
    ok: true,
    roomId: row.room_id,
    title: row.title,
    isLive: !!row.is_live,
  };
}
