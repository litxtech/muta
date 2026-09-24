import { supabase } from '../../../lib/supabase';
import type { Gift } from '../../../types/models';
import { KatalogCache } from '../../../ortak/onbellek/KatalogCache';

/** Gift tipi + animasyon UI alanları */
export const HEDIYE_SELECT = [
  'id',
  'code',
  'name',
  'emoji',
  'coin_cost',
  'diamond_value',
  'rarity',
  'animation',
  'slug',
  'category_code',
  'thumbnail_url',
  'animation_url',
  'animation_type',
  'duration_ms',
  'full_screen',
  'global_announcement',
  'combo_enabled',
  'combo_timeout_ms',
  'sort_order',
].join(', ');

export async function HediyeKatalogunuGetir(): Promise<Gift[]> {
  return KatalogCache.getOrFetch('gifts:active', async () => {
    const { data, error } = await supabase
      .from('gifts')
      .select(HEDIYE_SELECT)
      .eq('is_active', true)
      .order('sort_order');
    if (error) throw error;
    return (data as unknown as Gift[]) ?? [];
  });
}
