import { supabase } from '../../../lib/supabase';

export type PkMac = {
  id: string;
  pk_type: string;
  status: string;
  score_a: number;
  score_b: number;
  started_at: string | null;
  ends_at: string | null;
};

/** Skor client belirlemez — sadece okur */
export async function PkCanliMaclariGetir(): Promise<PkMac[]> {
  const { data, error } = await supabase
    .from('pk_matches')
    .select('id, pk_type, status, score_a, score_b, started_at, ends_at')
    .eq('status', 'live')
    .order('started_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data as PkMac[]) ?? [];
}

export async function PkSkorOku(matchId: string): Promise<PkMac | null> {
  const { data, error } = await supabase
    .from('pk_matches')
    .select('id, pk_type, status, score_a, score_b, started_at, ends_at')
    .eq('id', matchId)
    .maybeSingle();
  if (error) throw error;
  return data as PkMac | null;
}
