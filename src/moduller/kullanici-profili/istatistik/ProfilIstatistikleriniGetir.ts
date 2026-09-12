import { supabase } from '../../../lib/supabase';

export type KullaniciProfilIstatistikleri = {
  user_id: string;
  followers_count: number;
  following_count: number;
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
};

/** Profil acilisinda SUM/COUNT yok — denormalized satir */
export async function ProfilIstatistikleriniGetir(
  userId: string,
): Promise<KullaniciProfilIstatistikleri | null> {
  const { data, error } = await supabase
    .from('user_profile_stats')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as KullaniciProfilIstatistikleri | null;
}
