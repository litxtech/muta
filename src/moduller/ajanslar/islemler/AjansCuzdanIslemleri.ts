import { supabase } from '../../../lib/supabase';

function rpcHata(error: { message?: string } | null): never {
  throw new Error(error?.message || 'İşlem tamamlanamadı');
}

export type AjansCuzdanOzeti = {
  coins: number;
  diamonds: number;
  distribution_balance: number;
  lifetime_coins_sold: number;
  sale_gift_milestones: number;
  sonraki_hediye_icin: number;
};

export type AjansCuzdanHareket = {
  id: string;
  currency: 'coins' | 'diamonds' | 'distribution';
  delta: number;
  balance_after: number;
  reason: string;
  ref_type: string | null;
  ref_id: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
};

export type AjansCuzdanDurumu = {
  wallet: AjansCuzdanOzeti & { updated_at?: string };
  hareketler: AjansCuzdanHareket[];
};

export async function AjansCuzdanHareketleriGetir(
  agencyId: string,
  limit = 100,
): Promise<AjansCuzdanDurumu> {
  const { data, error } = await supabase.rpc('ajans_cuzdan_hareketleri', {
    p_agency_id: agencyId,
    p_limit: limit,
  });
  if (error) rpcHata(error);
  const d = data as AjansCuzdanDurumu;
  return {
    wallet: d.wallet,
    hareketler: Array.isArray(d.hareketler) ? d.hareketler : [],
  };
}
