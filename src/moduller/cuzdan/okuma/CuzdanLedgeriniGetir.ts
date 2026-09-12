import { supabase } from '../../../lib/supabase';

export type LedgerSatiri = {
  id: string;
  currency: string;
  delta: number;
  balance_after: number;
  reason: string;
  created_at: string;
};

export async function CuzdanLedgeriniGetir(limit = 50): Promise<LedgerSatiri[]> {
  const { data, error } = await supabase
    .from('wallet_ledger')
    .select('id, currency, delta, balance_after, reason, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as LedgerSatiri[]) ?? [];
}
