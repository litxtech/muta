/**
 * Kozmik Kaskad API — Edge Function üzerinden server sonucu.
 */

import { supabase } from '../../../../lib/supabase';
import { DEFAULT_MATH_CONFIG } from '../sabitler/KaskadSabitleri';
import type {
  KaskadMathConfig,
  KaskadSpinRequest,
  SpinResult,
} from '../tipler/KaskadTipleri';
import { FinansIdempotencyAnahtariOlustur } from '../../../cuzdan/islemler/FinansIdempotencyAnahtariOlustur';

export type SpinApiError = {
  ok: false;
  hata: string;
  code?: string;
};

export type SpinApiOk = {
  ok: true;
  data: SpinResult;
};

export type UnfinishedRound = {
  roundId: string;
  result: SpinResult;
  status: 'pending_playback' | 'settled';
};

function mapResult(raw: Record<string, unknown>): SpinResult {
  return raw as unknown as SpinResult;
}

export async function fetchKaskadConfig(): Promise<KaskadMathConfig> {
  const { data, error } = await supabase.rpc('kozmik_kaskad_aktif_config');
  if (error || !data) return DEFAULT_MATH_CONFIG;
  return { ...DEFAULT_MATH_CONFIG, ...(data as Partial<KaskadMathConfig>) };
}

export async function requestKaskadSpin(
  req: KaskadSpinRequest,
): Promise<SpinApiOk | SpinApiError> {
  const idempotencyKey =
    req.idempotencyKey ||
    FinansIdempotencyAnahtariOlustur('gift_send').replace('gift_send', 'kaskad_spin');

  const { data, error } = await supabase.functions.invoke('kozmik-kaskad-spin', {
    body: {
      betAmount: req.betAmount,
      idempotencyKey,
      roomId: req.roomId ?? null,
      bonusSessionId: req.bonusSessionId ?? null,
    },
  });

  if (error) {
    return { ok: false, hata: error.message || 'Spin isteği başarısız', code: 'network' };
  }

  const payload = data as {
    error?: string;
    code?: string;
    result?: SpinResult;
  } | null;

  if (!payload || payload.error || !payload.result) {
    return {
      ok: false,
      hata: payload?.error ?? 'Sunucu sonucu boş',
      code: payload?.code,
    };
  }

  return { ok: true, data: mapResult(payload.result as unknown as Record<string, unknown>) };
}

export async function restoreUnfinishedKaskadRound(): Promise<UnfinishedRound | null> {
  const { data, error } = await supabase.rpc('kozmik_kaskad_unfinished_round');
  if (error || !data) return null;
  const row = data as {
    round_id: string;
    result_snapshot: SpinResult;
    status: string;
  };
  if (!row.result_snapshot) return null;
  return {
    roundId: row.round_id,
    result: row.result_snapshot,
    status: row.status === 'settled' ? 'settled' : 'pending_playback',
  };
}

export async function markKaskadRoundPlayed(roundId: string): Promise<void> {
  await supabase.rpc('kozmik_kaskad_mark_played', { p_round_id: roundId });
}

export function newKaskadIdempotencyKey(): string {
  return FinansIdempotencyAnahtariOlustur('gift_send').replace(
    'gift_send',
    'kaskad_spin',
  );
}
