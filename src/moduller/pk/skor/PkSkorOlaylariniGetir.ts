import { supabase } from '../../../lib/supabase';

export type PkSkorOlayi = {
  id: string;
  match_id: string;
  side: string;
  delta: number;
  reason: string | null;
  created_at: string;
};

export async function PkSkorOlaylariniGetir(
  matchId: string,
  limit = 12,
): Promise<PkSkorOlayi[]> {
  const { data, error } = await supabase
    .from('pk_score_events')
    .select('id, match_id, side, delta, reason, created_at')
    .eq('match_id', matchId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as PkSkorOlayi[]) ?? [];
}

export function PkKalanSaniye(endsAt: string | null): number | null {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - Date.now();
  return Math.max(0, Math.floor(ms / 1000));
}
