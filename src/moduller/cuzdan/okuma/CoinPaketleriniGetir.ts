import { supabase } from '../../../lib/supabase';
import type { CoinPackage } from '../../../types/models';
import { KatalogCache } from '../../../ortak/onbellek/KatalogCache';

const COIN_PAKET_SELECT = [
  'id',
  'sku',
  'title',
  'coins',
  'bonus_coins',
  'price_usd',
  'price_try',
  'badge',
  'campaign_text',
  'sort_order',
  'apple_product_id',
  'google_product_id',
  'stripe_price_id',
].join(', ');

export async function CoinPaketleriniGetir(): Promise<CoinPackage[]> {
  return KatalogCache.getOrFetch('coin_packages:active', async () => {
    const { data, error } = await supabase
      .from('coin_packages')
      .select(COIN_PAKET_SELECT)
      .eq('is_active', true)
      .order('sort_order');
    if (error) throw error;
    return ((data as unknown as CoinPackage[]) ?? []);
  });
}
