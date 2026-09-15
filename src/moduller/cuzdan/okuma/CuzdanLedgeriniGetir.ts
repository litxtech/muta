import { supabase } from '../../../lib/supabase';

export type LedgerSatiri = {
  id: string;
  currency: string;
  delta: number;
  balance_after: number;
  reason: string;
  ref_type: string | null;
  created_at: string;
};

const SEBEP_ETIKET: Record<string, string> = {
  gift_send: 'Hediye gönderimi',
  gift_receive: 'Hediye geliri',
  gift_sent: 'Hediye gönderimi',
  gift_received: 'Hediye geliri',
  purchase: 'Coin yükleme',
  coin_purchase: 'Coin yükleme',
  iap: 'Mağaza yüklemesi',
  stripe: 'Kart ile yükleme',
  withdraw: 'Elmas çekimi',
  withdrawal: 'Elmas çekimi',
  withdrawal_hold: 'Çekim blokesi',
  withdrawal_refund: 'Çekim iadesi',
  agency_commission: 'Ajans komisyonu',
  host_earning: 'Ev sahibi kazancı',
  refund: 'İade',
  bonus: 'Bonus',
  admin_adjust: 'Yönetim düzeltmesi',
  admin_topup: 'Yönetim coin yükleme',
  admin_deduct: 'Yönetim coin eksiltme',
  admin_penalty: 'Yönetim coin cezası',
  game_entry: 'Oyun girişi',
  game_reward: 'Oyun ödülü',
  game_refund: 'Oyun iadesi',
};

function sebepKok(reason: string): string {
  const i = reason.indexOf(':');
  return i > 0 ? reason.slice(0, i) : reason;
}

export function LedgerSebepEtiketi(reason: string): string {
  const kok = sebepKok(reason);
  const etiket = SEBEP_ETIKET[kok] ?? SEBEP_ETIKET[reason];
  if (etiket) {
    const not = reason.includes(':') ? reason.slice(reason.indexOf(':') + 1).trim() : '';
    return not ? `${etiket} · ${not}` : etiket;
  }
  return reason.replace(/_/g, ' ');
}

export async function CuzdanLedgeriniGetir(limit = 50): Promise<LedgerSatiri[]> {
  const { data, error } = await supabase
    .from('wallet_ledger')
    .select('id, currency, delta, balance_after, reason, ref_type, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as LedgerSatiri[]) ?? [];
}
