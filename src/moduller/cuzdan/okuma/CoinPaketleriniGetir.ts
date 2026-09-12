import { supabase } from '../../../lib/supabase';
import type { CoinPackage } from '../../../types/models';

export async function CoinPaketleriniGetir(): Promise<CoinPackage[]> {
  const { data, error } = await supabase
    .from('coin_packages')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return (data as CoinPackage[]) ?? [];
}
