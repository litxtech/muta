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

export type AdminCuzdanTransfer = {
  id: string;
  sender_id: string;
  receiver_id: string;
  coins: number;
  receiver_wallet_number: string;
  receiver_first_name: string;
  receiver_last_name: string;
  status: string;
  fail_reason: string | null;
  created_at: string;
  sender?: {
    display_name: string | null;
    username: string | null;
  } | null;
  receiver?: {
    display_name: string | null;
    username: string | null;
  } | null;
};

export type AdminCuzdanTakasLimit = {
  id: number;
  monthly_transfer_limit: number;
  monthly_trade_limit: number;
  updated_at: string;
  updated_by: string | null;
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

export async function AdminTransferListesi(
  limit = 80,
): Promise<AdminCuzdanTransfer[]> {
  const { data, error } = await supabase
    .from('coin_wallet_transfers')
    .select(
      `*,
      sender:sender_id(display_name, username),
      receiver:receiver_id(display_name, username)`,
    )
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as AdminCuzdanTransfer[]) ?? [];
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

export async function AdminCuzdanTakasLimitGetir(): Promise<AdminCuzdanTakasLimit> {
  const { data, error } = await supabase.rpc('admin_cuzdan_takas_limit_getir');
  if (error) throw new Error(error.message);
  return data as AdminCuzdanTakasLimit;
}

export async function AdminCuzdanTakasLimitAyarla(
  monthlyTransferLimit: number,
  monthlyTradeLimit: number,
): Promise<AdminCuzdanTakasLimit> {
  const { data, error } = await supabase.rpc('admin_cuzdan_takas_limit_ayarla', {
    p_monthly_transfer_limit: monthlyTransferLimit,
    p_monthly_trade_limit: monthlyTradeLimit,
  });
  if (error) throw new Error(error.message);
  return data as AdminCuzdanTakasLimit;
}
