import { supabase } from '../../../lib/supabase';

export type MikrofonIstegi = {
  id: string;
  room_id: string;
  user_id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  created_at: string;
  profile?: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
    vip_level?: number | null;
  } | null;
};

export async function MikrofonIstekleriniGetir(
  odaId: string,
): Promise<MikrofonIstegi[]> {
  const { data, error } = await supabase
    .from('room_mic_requests')
    .select(
      'id, room_id, user_id, status, created_at, profile:profiles(display_name, username, avatar_url)',
    )
    .eq('room_id', odaId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(40);
  if (error) throw error;
  return (data as unknown as MikrofonIstegi[]) ?? [];
}
