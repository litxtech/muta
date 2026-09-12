import { supabase } from '../../../lib/supabase';

export type MutabakatKaydi = {
  id: string;
  kind: string;
  status: 'ok' | 'mismatch' | 'error' | string;
  details: Record<string, unknown> | null;
  created_at: string;
};

export async function MutabakatSonuclariniGetir(
  limit = 10,
): Promise<MutabakatKaydi[]> {
  const { data, error } = await supabase
    .from('reconciliation_runs')
    .select('id, kind, status, details, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as MutabakatKaydi[];
}
