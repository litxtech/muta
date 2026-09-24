import { supabase } from '../../../lib/supabase';
import { KatalogCache } from '../../../ortak/onbellek/KatalogCache';

export async function OdaKapasiteKatmanlariniGetir() {
  return KatalogCache.getOrFetch('room_capacity_tiers', async () => {
    const { data, error } = await supabase
      .from('room_capacity_tiers')
      .select(
        'id, code, name, audience_capacity, microphone_capacity, sort_order, is_active',
      )
      .eq('is_active', true)
      .order('sort_order');
    if (error) throw error;
    return data ?? [];
  });
}

export async function OdaDuzenKatalogunuGetir() {
  return KatalogCache.getOrFetch('room_layouts', async () => {
    const { data, error } = await supabase
      .from('room_layouts')
      .select(
        'id, code, name, description, unlock_rule, is_active, sort_order',
      )
      .eq('is_active', true)
      .order('sort_order');
    if (error) throw error;
    return data ?? [];
  });
}
