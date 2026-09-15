/**
 * Oyun oturum servisi — Supabase RPC sarmalayıcıları.
 * Wallet / ödül mutasyonu sunucu tarafındadır; client yalnızca RPC çağırır.
 */

import { supabase } from '../../../../lib/supabase';
import { GameLogger } from '../../cekirdek/OyunLogger';
import type {
  CreateGameSessionParams,
  GameSession,
  GameSessionPlayer,
  JoinGameSessionParams,
  LeaderboardEntry,
  RpcResult,
  SubmitGameScoreParams,
} from '../tipler/OyunTipleri';

function rpcHata(error: { message?: string } | null): string {
  return error?.message?.trim() || 'Bilinmeyen sunucu hatası';
}

export async function createGameSession(
  params: CreateGameSessionParams,
): Promise<RpcResult<GameSession>> {
  try {
    const { data, error } = await supabase.rpc('create_game_session', {
      p_room_id: params.roomId,
      p_game_code: params.gameCode,
      p_duration_seconds: params.durationSeconds ?? null,
      p_max_players: params.maxPlayers ?? null,
      p_entry_amount: params.entryAmount ?? 0,
    });
    if (error) {
      GameLogger.error('create_game_session', { hata: error.message });
      return { ok: false, hata: rpcHata(error) };
    }
    return { ok: true, data: data as GameSession };
  } catch (e) {
    const hata = e instanceof Error ? e.message : 'create_game_session başarısız';
    GameLogger.error('create_game_session', { hata });
    return { ok: false, hata };
  }
}

/** Odadaki waiting / countdown / playing oturumu (en yeni). */
export async function aktifOyunOturumuGetir(
  roomId: string,
): Promise<GameSession | null> {
  const { data, error } = await supabase
    .from('game_sessions')
    .select('*')
    .eq('room_id', roomId)
    .in('status', ['waiting', 'countdown', 'playing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    GameLogger.warn('aktif_oyun_oturumu', { hata: error.message });
    return null;
  }
  return (data as GameSession | null) ?? null;
}

export async function joinGameSession(
  params: JoinGameSessionParams,
): Promise<RpcResult<GameSessionPlayer>> {
  try {
    const { data, error } = await supabase.rpc('join_game_session', {
      p_session_id: params.sessionId,
      p_entry_amount: params.entryAmount ?? 0,
    });
    if (error) {
      GameLogger.error('join_game_session', { hata: error.message });
      return { ok: false, hata: rpcHata(error) };
    }
    return { ok: true, data: data as GameSessionPlayer };
  } catch (e) {
    const hata = e instanceof Error ? e.message : 'join_game_session başarısız';
    GameLogger.error('join_game_session', { hata });
    return { ok: false, hata };
  }
}

export async function startGameSession(
  sessionId: string,
): Promise<RpcResult<GameSession>> {
  try {
    const { data, error } = await supabase.rpc('start_game_session', {
      p_session_id: sessionId,
    });
    if (error) {
      GameLogger.error('start_game_session', { hata: error.message });
      return { ok: false, hata: rpcHata(error) };
    }
    return { ok: true, data: data as GameSession };
  } catch (e) {
    const hata = e instanceof Error ? e.message : 'start_game_session başarısız';
    GameLogger.error('start_game_session', { hata });
    return { ok: false, hata };
  }
}

export async function submitGameScore(
  params: SubmitGameScoreParams,
): Promise<RpcResult<{ updated: boolean }>> {
  try {
    const { data, error } = await supabase.rpc('submit_game_score', {
      p_session_id: params.sessionId,
      p_score: params.score,
      p_move_count: params.moveCount,
      p_highest_combo: params.highestCombo,
      p_special_tiles_used: params.specialTilesUsed ?? 0,
      p_board_hash: params.boardHash ?? null,
    });
    if (error) {
      GameLogger.error('submit_game_score', { hata: error.message });
      return { ok: false, hata: rpcHata(error) };
    }
    const updated =
      typeof data === 'boolean'
        ? data
        : Boolean((data as { updated?: boolean } | null)?.updated ?? true);
    return { ok: true, data: { updated } };
  } catch (e) {
    const hata = e instanceof Error ? e.message : 'submit_game_score başarısız';
    GameLogger.error('submit_game_score', { hata });
    return { ok: false, hata };
  }
}

export async function finishGameSession(
  sessionId: string,
): Promise<RpcResult<{ rankings: LeaderboardEntry[] }>> {
  try {
    const { data, error } = await supabase.rpc('finish_game_session', {
      p_session_id: sessionId,
    });
    if (error) {
      GameLogger.error('finish_game_session', { hata: error.message });
      return { ok: false, hata: rpcHata(error) };
    }
    const rankings = Array.isArray(data)
      ? (data as LeaderboardEntry[])
      : ((data as { rankings?: LeaderboardEntry[] } | null)?.rankings ?? []);
    return { ok: true, data: { rankings } };
  } catch (e) {
    const hata = e instanceof Error ? e.message : 'finish_game_session başarısız';
    GameLogger.error('finish_game_session', { hata });
    return { ok: false, hata };
  }
}

export const OyunOturumServisi = {
  createGameSession,
  aktifOyunOturumuGetir,
  joinGameSession,
  startGameSession,
  submitGameScore,
  finishGameSession,
} as const;
