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
  thread_kind?: string | null;
  thread_title?: string | null;
  peer_is_verified?: boolean | null;
  peer_is_platform_official?: boolean | null;
  closed_at?: string | null;
  peer_agency_id?: string | null;
};

export async function MesajKonulariniGetir(
  arsiv = false,
): Promise<MesajKonusu[]> {
  const normalize = (rows: MesajKonusu[]): MesajKonusu[] =>
    ((rows as MesajKonusu[]) ?? [])
      .filter((r) => typeof r?.id === 'string' && r.id.length > 0)
      .map((r) => ({
        ...r,
        unread_count: Number(r.unread_count) || 0,
      }));

  const { data, error } = await supabase.rpc('mesaj_konularini_getir', {
    p_limit: 50,
    p_arsiv: arsiv,
  });

  if (!error && data) {
    return normalize(data as MesajKonusu[]);
  }

  // Fallback eski 1-arg RPC
  const fb = await supabase.rpc('mesaj_konularini_getir', { p_limit: 50 });
  if (!fb.error && fb.data) {
    return normalize(fb.data as MesajKonusu[]);
  }
  return [];
}
