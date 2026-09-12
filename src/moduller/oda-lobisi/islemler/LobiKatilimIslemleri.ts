import { supabase } from '../../../lib/supabase';

export async function LobiyeKatil(odaId: string): Promise<{ ok: boolean; hata?: string }> {
  const { error } = await supabase.rpc('lobiye_katil', { p_room_id: odaId });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}

export async function LobidenAyril(odaId: string): Promise<{ ok: boolean; hata?: string }> {
  const { error } = await supabase.rpc('lobiden_ayril', { p_room_id: odaId });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}

export async function LobiKatilimcilariniGetir(odaId: string) {
  const { data, error } = await supabase
    .from('room_lobby_presence')
    .select('user_id, joined_at, profile:profiles(id, display_name, username, avatar_url, public_user_id, level)')
    .eq('room_id', odaId)
    .order('joined_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
