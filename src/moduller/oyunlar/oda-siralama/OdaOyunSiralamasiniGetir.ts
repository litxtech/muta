import { supabase } from '../../../lib/supabase';

export type OdaOyunSiralamaSatiri = {
  user_id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  won_coin: number;
  spent_coin: number;
  net_coin: number;
  rank: number;
};

export async function OdaOyunSiralamasiniGetir(
  roomId: string,
  limit = 20,
): Promise<OdaOyunSiralamaSatiri[]> {
  const { data, error } = await supabase.rpc('oda_oyun_siralamasi', {
    p_room_id: roomId,
    p_limit: limit,
  });
  if (error) throw error;
  return ((data as OdaOyunSiralamaSatiri[]) ?? []).map((r) => ({
    ...r,
    won_coin: Number(r.won_coin) || 0,
    spent_coin: Number(r.spent_coin) || 0,
    net_coin: Number(r.net_coin) || 0,
    rank: Number(r.rank) || 0,
  }));
}
