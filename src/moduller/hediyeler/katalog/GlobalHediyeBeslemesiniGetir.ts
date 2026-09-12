import { supabase } from '../../../lib/supabase';

export type GlobalHediyeBanner = {
  id: string;
  coins_spent: number;
  created_at: string;
  sender_id: string;
  receiver_id: string;
  gift_id: string;
  room_id: string | null;
};

export async function GlobalHediyeBeslemesiniGetir(limit = 20): Promise<GlobalHediyeBanner[]> {
  const { data, error } = await supabase
    .from('global_gift_feed')
    .select('id, coins_spent, created_at, sender_id, receiver_id, gift_id, room_id')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as GlobalHediyeBanner[]) ?? [];
}
