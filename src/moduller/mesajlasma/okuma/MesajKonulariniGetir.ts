import { supabase } from '../../../lib/supabase';

export type MesajKonusu = {
  id: string;
  updated_at: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  peer_id?: string | null;
  peer_display_name?: string | null;
  peer_username?: string | null;
  peer_avatar_url?: string | null;
  unread_count?: number;
  archived_at?: string | null;
};

export async function MesajKonulariniGetir(
  arsiv = false,
): Promise<MesajKonusu[]> {
  const { data, error } = await supabase.rpc('mesaj_konularini_getir', {
    p_limit: 50,
    p_arsiv: arsiv,
  });

  if (!error && data) {
    return ((data as MesajKonusu[]) ?? []).map((r) => ({
      ...r,
      unread_count: Number(r.unread_count) || 0,
    }));
  }

  // Fallback eski 1-arg RPC
  const fb = await supabase.rpc('mesaj_konularini_getir', { p_limit: 50 });
  if (!fb.error && fb.data) {
    return (fb.data as MesajKonusu[]) ?? [];
  }
  return [];
}
