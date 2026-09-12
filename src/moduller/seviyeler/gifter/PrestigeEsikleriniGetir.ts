import { supabase } from '../../../lib/supabase';

export type EsikSeviye = {
  level: number;
  name: string;
  badge: string | null;
};

export async function GifterSeviyeleriniGetir(): Promise<(EsikSeviye & { min_spent_coin: number })[]> {
  const { data, error } = await supabase
    .from('gifter_levels')
    .select('level, name, min_spent_coin, badge')
    .eq('is_active', true)
    .order('level');
  if (error) throw error;
  return data ?? [];
}

export async function CharmSeviyeleriniGetir(): Promise<(EsikSeviye & { min_received_gifts: number })[]> {
  const { data, error } = await supabase
    .from('charm_levels')
    .select('level, name, min_received_gifts, badge')
    .eq('is_active', true)
    .order('level');
  if (error) throw error;
  return data ?? [];
}

export async function RechargeSeviyeleriniGetir(): Promise<(EsikSeviye & { min_topup_coin: number })[]> {
  const { data, error } = await supabase
    .from('recharge_levels')
    .select('level, name, min_topup_coin, badge')
    .eq('is_active', true)
    .order('level');
  if (error) throw error;
  return data ?? [];
}
