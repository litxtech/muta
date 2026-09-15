/**
 * Oyun oyuncu istatistikleri — profil / sıralama için okuma.
 */

import { supabase } from '../../../../lib/supabase';
import { ligEtiketi } from '../sabitler/OyunSabitleri';

export type OyunOyuncuIstatistik = {
  userId: string;
  totalGames: number;
  wins: number;
  secondPlaces: number;
  thirdPlaces: number;
  totalScore: number;
  highestScore: number;
  highestCombo: number;
  xp: number;
  trophies: number;
  level: number;
  leagueLabel: string;
  winRate: number;
};

export type OyunSessionOyuncuSatiri = {
  id: string;
  session_id: string;
  user_id: string;
  status: string;
  joined_at: string;
  finished_at: string | null;
  disconnected_at: string | null;
  final_rank: number | null;
  xp_earned: number;
  trophy_change: number;
  coin_reward: number;
  profiles: { display_name: string | null; avatar_url: string | null } | null;
  game_scores: { score: number; highest_combo: number; move_count: number } | null;
};

export async function OyunOyuncuIstatistikGetir(
  userId: string,
): Promise<OyunOyuncuIstatistik | null> {
  const { data, error } = await supabase
    .from('game_player_stats')
    .select(
      'user_id, total_games, wins, second_places, third_places, total_score, highest_score, highest_combo, xp, trophies, level',
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    return {
      userId,
      totalGames: 0,
      wins: 0,
      secondPlaces: 0,
      thirdPlaces: 0,
      totalScore: 0,
      highestScore: 0,
      highestCombo: 0,
      xp: 0,
      trophies: 0,
      level: 1,
      leagueLabel: ligEtiketi(0),
      winRate: 0,
    };
  }

  const totalGames = Number(data.total_games ?? 0);
  const wins = Number(data.wins ?? 0);
  const trophies = Number(data.trophies ?? 0);

  return {
    userId: data.user_id as string,
    totalGames,
    wins,
    secondPlaces: Number(data.second_places ?? 0),
    thirdPlaces: Number(data.third_places ?? 0),
    totalScore: Number(data.total_score ?? 0),
    highestScore: Number(data.highest_score ?? 0),
    highestCombo: Number(data.highest_combo ?? 0),
    xp: Number(data.xp ?? 0),
    trophies,
    level: Number(data.level ?? 1),
    leagueLabel: ligEtiketi(trophies),
    winRate: totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0,
  };
}

export async function OyunSessionOyunculariniGetir(
  sessionId: string,
): Promise<OyunSessionOyuncuSatiri[]> {
  const { data: players, error } = await supabase
    .from('game_session_players')
    .select(
      'id, session_id, user_id, status, joined_at, finished_at, disconnected_at, final_rank, xp_earned, trophy_change, coin_reward',
    )
    .eq('session_id', sessionId);

  if (error) throw error;
  if (!players?.length) return [];

  const userIds = players.map((p) => p.user_id as string);

  const [{ data: profiles }, { data: scores }] = await Promise.all([
    supabase.from('profiles').select('id, display_name, avatar_url').in('id', userIds),
    supabase
      .from('game_scores')
      .select('user_id, score, highest_combo, move_count')
      .eq('session_id', sessionId),
  ]);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [
      p.id as string,
      {
        display_name: (p.display_name as string | null) ?? null,
        avatar_url: (p.avatar_url as string | null) ?? null,
      },
    ]),
  );
  const scoreMap = new Map(
    (scores ?? []).map((s) => [
      s.user_id as string,
      {
        score: Number(s.score ?? 0),
        highest_combo: Number(s.highest_combo ?? 0),
        move_count: Number(s.move_count ?? 0),
      },
    ]),
  );

  return players.map((row) => ({
    id: String(row.id),
    session_id: String(row.session_id),
    user_id: String(row.user_id),
    status: String(row.status),
    joined_at: String(row.joined_at),
    finished_at: (row.finished_at as string | null) ?? null,
    disconnected_at: (row.disconnected_at as string | null) ?? null,
    final_rank: (row.final_rank as number | null) ?? null,
    xp_earned: Number(row.xp_earned ?? 0),
    trophy_change: Number(row.trophy_change ?? 0),
    coin_reward: Number(row.coin_reward ?? 0),
    profiles: profileMap.get(String(row.user_id)) ?? null,
    game_scores: scoreMap.get(String(row.user_id)) ?? null,
  }));
}
