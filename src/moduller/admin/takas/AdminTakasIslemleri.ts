import { supabase } from '../../../lib/supabase';
import type { CoinTradeOffer } from '../../cuzdan/takas/CuzdanTakasTipleri';

export type AdminTakasTeklif = CoinTradeOffer & {
  seller?: {
    display_name: string | null;
    username: string | null;
  } | null;
  buyer?: {
    display_name: string | null;
    username: string | null;
  } | null;
  agency?: {
    name: string | null;
    agency_public_id: string | null;
  } | null;
};

export async function AdminTakasListesi(
  limit = 50,
): Promise<AdminTakasTeklif[]> {
  const { data, error } = await supabase
    .from('coin_trade_offers')
    .select(
      `*,
      seller:seller_id(display_name, username),
      buyer:buyer_user_id(display_name, username),
      agency:buyer_agency_id(name, agency_public_id)`,
    )
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as AdminTakasTeklif[]) ?? [];
}

export async function AdminTakasPlatformOnay(
  offerId: string,
  accept: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('admin_coin_takas_platform_onay', {
    p_offer_id: offerId,
    p_accept: accept,
  });
  if (error) throw new Error(error.message);
}
