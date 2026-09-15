import { supabase } from '../../../lib/supabase';

export type SiralamaSatiri = {
  id: string;
  user_id: string | null;
  score: number;
  rank: number | null;
  board_type: string;
  period: string;
  period_key?: string;
  display_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
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

/** Top Recharge ve Top Gifter AYRI board — profil alanlari dahil */
export async function LiderlikSiralamasiniGetir(input: {
  board: SiralamaBoard;
  period?: SiralamaPeriod;
  limit?: number;
}): Promise<SiralamaSatiri[]> {
  const period = input.period ?? 'weekly';
  const { data, error } = await supabase.rpc('liderlik_siralamasi_listele', {
    p_board_type: input.board,
    p_period: period,
    p_limit: input.limit ?? 50,
  });

  if (error) throw error;
  return ((data as SiralamaSatiri[]) ?? []).map((r) => ({
    ...r,
    score: Number(r.score) || 0,
  }));
}

export async function LiderlikSiralamasiniYenile(
  board: SiralamaBoard,
  period: SiralamaPeriod = 'weekly',
): Promise<{ ok: boolean; hata?: string }> {
  const { error } = await supabase.rpc('liderlik_siralamasi_yenile', {
    p_board_type: board,
    p_period: period,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}

export function CoinSkoruFormatla(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}B`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}B`;
  return String(n);
}
