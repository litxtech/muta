import { supabase } from '../../../lib/supabase';

export type VipSeviye = {
  level: number;
  name: string;
  min_spend_coin: number;
  badge: string | null;
  profile_frame: string | null;
  entrance_effect: string | null;
};

export async function VipSeviyeleriniGetir(): Promise<VipSeviye[]> {
  const { data, error } = await supabase
    .from('vip_levels')
    .select('level, name, min_spend_coin, badge, profile_frame, entrance_effect')
    .eq('is_active', true)
    .order('level');
  if (error) throw error;
  return (data as VipSeviye[]) ?? [];
}

export async function KullaniciVipSeviyesiniGetir(userId: string): Promise<number> {
  const { data } = await supabase
    .from('user_profile_stats')
    .select('vip_level')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.vip_level ?? 0;
}
