import { supabase } from '../../../lib/supabase';

export type KullaniciProfilIstatistikleri = {
  user_id: string;
  followers_count: number;
  following_count: number;
  posts_count?: number;
  pending_follow_requests_count?: number;
  likes_count: number;
  total_topup_coin: number;
  total_spent_coin: number;
  total_gifts_sent: number;
  total_gifts_received: number;
  recharge_rank: number | null;
  gifter_rank: number | null;
  charm_level: number;
  vip_level: number;
  agency_id: string | null;
  host_status: string;
  account_value: number;
  account_value_label: string;
  account_value_override?: boolean;
  account_value_version?: number;
  account_value_updated_at?: string | null;
};

const STATS_SELECT = [
  'user_id',
  'followers_count',
  'following_count',
  'posts_count',
  'pending_follow_requests_count',
  'likes_count',
  'total_topup_coin',
  'total_spent_coin',
  'total_gifts_sent',
  'total_gifts_received',
  'recharge_rank',
  'gifter_rank',
  'charm_level',
  'vip_level',
  'agency_id',
  'host_status',
  'account_value',
  'account_value_label',
  'account_value_override',
  'account_value_version',
  'account_value_updated_at',
].join(', ');

/** Profil acilisinda SUM/COUNT yok — denormalized satir */
export async function ProfilIstatistikleriniGetir(
  userId: string,
): Promise<KullaniciProfilIstatistikleri | null> {
  const { data, error } = await supabase
    .from('user_profile_stats')
    .select(STATS_SELECT)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as KullaniciProfilIstatistikleri | null;
}
