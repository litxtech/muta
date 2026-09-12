import { supabase } from '../../../lib/supabase';

export type SiralamaSatiri = {
  id: string;
  user_id: string | null;
  score: number;
  rank: number | null;
  board_type: string;
  period: string;
};

export type SiralamaBoard =
  | 'host'
  | 'gifter'
  | 'agency'
  | 'room'
  | 'top_recharge'
  | 'city'
  | 'city_supporter';

export type SiralamaPeriod = 'daily' | 'weekly' | 'monthly' | 'all_time';

/** Top Recharge ve Top Gifter AYRI board */
export async function LiderlikSiralamasiniGetir(input: {
  board: SiralamaBoard;
  period?: SiralamaPeriod;
  limit?: number;
}): Promise<SiralamaSatiri[]> {
  const period = input.period ?? 'daily';
  const periodKey = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('leaderboard_snapshots')
    .select('id, user_id, score, rank, board_type, period')
    .eq('board_type', input.board)
    .eq('period', period)
    .eq('period_key', periodKey)
    .order('rank', { ascending: true })
    .limit(input.limit ?? 50);

  if (error) throw error;
  return (data as SiralamaSatiri[]) ?? [];
}

export async function LiderlikSiralamasiniYenile(
  board: SiralamaBoard,
  period: SiralamaPeriod = 'daily',
): Promise<{ ok: boolean; hata?: string }> {
  const { error } = await supabase.rpc('liderlik_siralamasi_yenile', {
    p_board_type: board,
    p_period: period,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}
