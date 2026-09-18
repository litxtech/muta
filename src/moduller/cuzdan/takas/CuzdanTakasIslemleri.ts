import { supabase } from '../../../lib/supabase';
import { FinansIdempotencyAnahtariOlustur } from '../islemler/FinansIdempotencyAnahtariOlustur';
import type { CoinTradeOffer } from './CuzdanTakasTipleri';

export async function CuzdanNoIleTransfer(input: {
  walletNumber: string;
  firstName: string;
  lastName: string;
  coins: number;
}): Promise<{ ok: true } | { ok: false; hata: string }> {
  const { error } = await supabase.rpc('cuzdan_no_ile_coin_transfer', {
    p_wallet_number: input.walletNumber.replace(/\D/g, ''),
    p_first_name: input.firstName.trim(),
    p_last_name: input.lastName.trim(),
    p_coins: Math.floor(input.coins),
    p_idempotency_key: FinansIdempotencyAnahtariOlustur('wallet_tx'),
  });
  if (error) {
    const m = error.message || '';
    if (/name mismatch/i.test(m)) {
      return {
        ok: false,
        hata: 'İsim soyisim eşleşmedi — transfer iptal edildi.',
      };
    }
    if (/kyc required/i.test(m)) {
      return { ok: false, hata: 'Alıcının kimlik onayı tamamlanmamış.' };
    }
    if (/18 digits/i.test(m)) {
      return { ok: false, hata: 'Cüzdan numarası 18 haneli olmalı.' };
    }
    if (/insufficient/i.test(m)) {
      return { ok: false, hata: 'Yetersiz coin bakiyesi.' };
    }
    if (/not found/i.test(m)) {
      return { ok: false, hata: 'Cüzdan bulunamadı.' };
    }
    return { ok: false, hata: m };
  }
  return { ok: true };
}

export async function TakasAjansAra(q?: string) {
  const { data, error } = await supabase.rpc('takas_ajans_ara', {
    p_q: q ?? null,
  });
  if (error) return [] as {
    id: string;
    name: string;
    agency_public_id: string | null;
    logo_url: string | null;
    status: string;
  }[];
  return (data ?? []) as {
    id: string;
    name: string;
    agency_public_id: string | null;
    logo_url: string | null;
    status: string;
  }[];
}

export async function TakasKullaniciAra(q: string) {
  const { data, error } = await supabase.rpc('takas_kullanici_ara', {
    p_q: q,
  });
  if (error) return [];
  return (data ?? []) as {
    id: string;
    display_name: string | null;
    username: string | null;
    wallet_number: string;
    avatar_url: string | null;
  }[];
}

export async function TakasTeklifOlustur(input: {
  buyerType: 'user' | 'agency';
  buyerUserId?: string | null;
  buyerAgencyId?: string | null;
  coins: number;
  note?: string;
}): Promise<{ ok: true; offer: CoinTradeOffer } | { ok: false; hata: string }> {
  const { data, error } = await supabase.rpc('coin_takas_teklif_olustur', {
    p_buyer_type: input.buyerType,
    p_buyer_user_id: input.buyerUserId ?? null,
    p_buyer_agency_id: input.buyerAgencyId ?? null,
    p_coins: Math.floor(input.coins),
    p_note: input.note ?? null,
  });
  if (error) {
    if (/kyc required/i.test(error.message)) {
      return { ok: false, hata: 'Takas için kimlik onayı gerekli.' };
    }
    return { ok: false, hata: error.message };
  }
  return { ok: true, offer: data as CoinTradeOffer };
}

export async function TakasAliciYanit(
  offerId: string,
  accept: boolean,
): Promise<{ ok: true } | { ok: false; hata: string }> {
  const { error } = await supabase.rpc('coin_takas_alici_yanit', {
    p_offer_id: offerId,
    p_accept: accept,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}

export async function TakasTekliflerimiGetir(): Promise<CoinTradeOffer[]> {
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user?.id;
  if (!uid) return [];
  const { data } = await supabase
    .from('coin_trade_offers')
    .select('*')
    .or(`seller_id.eq.${uid},buyer_user_id.eq.${uid}`)
    .order('created_at', { ascending: false })
    .limit(40);
  return (data as CoinTradeOffer[]) ?? [];
}
