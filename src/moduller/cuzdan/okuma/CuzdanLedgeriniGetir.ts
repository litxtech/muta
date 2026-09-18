import { supabase } from '../../../lib/supabase';

export type LedgerSatiri = {
  id: string;
  currency: string;
  delta: number;
  balance_after: number;
  reason: string;
  ref_type: string | null;
  ref_id: string | null;
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
  agency_distribution: 'Ajans coin yükleme',
  host_earning: 'Ev sahibi kazancı',
  refund: 'İade',
  bonus: 'Bonus',
  admin_adjust: 'Yönetim düzeltmesi',
  admin_topup: 'Yönetim coin yükleme',
  admin_deduct: 'Yönetim coin eksiltme',
  admin_penalty: 'Yönetim coin cezası',
  game_entry: 'Oyun girişi (bahis)',
  game_reward: 'Oyun ödülü (kazanç)',
  game_refund: 'Oyun iadesi',
  kaskad_bet: 'Kozmik Kaskad — bahis',
  kaskad_win: 'Kozmik Kaskad — kazanç',
  kaskad_refund: 'Kozmik Kaskad — iade',
  zeus_bet: 'ZEUS — bahis',
  zeus_win: 'ZEUS — kazanç',
  live_gift: 'Canlı yayın hediyesi',
  status_gift: 'Durum hediyesi',
};

const REF_ETIKET: Record<string, string> = {
  gift: 'Hediye işlemi',
  purchase: 'Yükleme',
  coin_purchase: 'Coin yükleme',
  iap: 'Uygulama mağazası',
  stripe: 'Kart ödemesi',
  withdrawal: 'Çekim talebi',
  withdraw: 'Çekim talebi',
  game_session: 'Oyun oturumu',
  kaskad_round: 'Kozmik Kaskad turu',
  admin: 'Yönetim',
  agency: 'Ajans',
  agency_transfer: 'Ajans transferi',
  host: 'Ev sahibi',
  live: 'Canlı yayın',
  room: 'Oda',
};

function sebepKok(reason: string): string {
  const i = reason.indexOf(':');
  return i > 0 ? reason.slice(0, i) : reason;
}

export function LedgerSebepEtiketi(reason: string): string {
  const kok = sebepKok(reason);
  const etiket = SEBEP_ETIKET[kok] ?? SEBEP_ETIKET[reason];
  if (etiket) {
    const not =
      reason.includes(':') ? reason.slice(reason.indexOf(':') + 1).trim() : '';
    return not ? `${etiket} · ${not}` : etiket;
  }
  return reason.replace(/_/g, ' ');
}

export function LedgerRefEtiketi(refType: string | null | undefined): string {
  if (!refType) return '—';
  return REF_ETIKET[refType] ?? refType.replace(/_/g, ' ');
}

export function LedgerBirimEtiketi(currency: string): string {
  if (currency === 'diamonds' || currency === 'diamond') return 'elmas';
  if (currency === 'coins' || currency === 'coin') return 'coin';
  return currency;
}

/** Satırın kullanıcıya gösterilecek kısa Türkçe özeti */
export function LedgerAnlasilirOzet(row: LedgerSatiri): string {
  const sebep = LedgerSebepEtiketi(row.reason);
  const kok = sebepKok(row.reason);
  if (kok === 'agency_distribution') return sebep;
  const ref = LedgerRefEtiketi(row.ref_type);
  if (!row.ref_type || ref === '—' || sebep.includes(ref)) return sebep;
  return `${sebep} · ${ref}`;
}

export function LedgerTutarYazi(row: LedgerSatiri): string {
  const isaret = row.delta >= 0 ? '+' : '';
  return `${isaret}${row.delta.toLocaleString('tr-TR')} ${LedgerBirimEtiketi(row.currency)}`;
}

export async function CuzdanLedgeriniGetir(limit = 50): Promise<LedgerSatiri[]> {
  const { data, error } = await supabase
    .from('wallet_ledger')
    .select('id, currency, delta, balance_after, reason, ref_type, ref_id, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data as LedgerSatiri[]) ?? []).map((r) => ({
    ...r,
    delta: Number(r.delta ?? 0),
    balance_after: Number(r.balance_after ?? 0),
    ref_id: (r.ref_id as string | null) ?? null,
  }));
}
