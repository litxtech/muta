import { supabase } from '../../../lib/supabase';
import type { Gift } from '../../../types/models';

export type HediyeKategori = {
  id: string;
  code: string;
  name: string;
  sort_order: number;
};

export async function HediyeKategorileriniGetir(): Promise<HediyeKategori[]> {
  const { data, error } = await supabase
    .from('gift_categories')
    .select('id, code, name, sort_order')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return (data as HediyeKategori[]) ?? [];
}

/** Lazy: sadece görünür katalog — animasyon URL'leri ayrıca indirilir */
export async function HediyeKatalogunuFiltrele(input?: {
  categoryCode?: string;
  limit?: number;
  offset?: number;
}): Promise<Gift[]> {
  let q = supabase
    .from('gifts')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
    .range(input?.offset ?? 0, (input?.offset ?? 0) + (input?.limit ?? 40) - 1);

  if (input?.categoryCode) {
    q = q.eq('category_code', input.categoryCode);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data as Gift[]) ?? [];
}
