import { supabase } from '../../../lib/supabase';
import type { Gift } from '../../../types/models';
import { KatalogCache } from '../../../ortak/onbellek/KatalogCache';
import { HEDIYE_SELECT } from '../okuma/HediyeKatalogunuGetir';

export type HediyeKategori = {
  id: string;
  code: string;
  name: string;
  sort_order: number;
};

export async function HediyeKategorileriniGetir(): Promise<HediyeKategori[]> {
  return KatalogCache.getOrFetch('gift_categories:active', async () => {
    const { data, error } = await supabase
      .from('gift_categories')
      .select('id, code, name, sort_order')
      .eq('is_active', true)
      .order('sort_order');
    if (error) throw error;
    return (data as HediyeKategori[]) ?? [];
  });
}

/** Lazy: sadece görünür katalog — animasyon URL'leri ayrıca indirilir */
export async function HediyeKatalogunuFiltrele(input?: {
  categoryCode?: string;
  limit?: number;
  offset?: number;
}): Promise<Gift[]> {
  const categoryCode = input?.categoryCode ?? '';
  const offset = input?.offset ?? 0;
  const limit = input?.limit ?? 40;
  const key = `gifts:filter:${categoryCode}:${offset}:${limit}`;

  return KatalogCache.getOrFetch(key, async () => {
    let q = supabase
      .from('gifts')
      .select(HEDIYE_SELECT)
      .eq('is_active', true)
      .order('sort_order')
      .range(offset, offset + limit - 1);

    if (input?.categoryCode) {
      q = q.eq('category_code', input.categoryCode);
    }

    const { data, error } = await q;
    if (error) throw error;
    return (data as unknown as Gift[]) ?? [];
  });
}
