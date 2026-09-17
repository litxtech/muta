/**
 * NOX REELS API — Edge Function üzerinden server sonucu.
 */

import { supabase } from '../../../../lib/supabase';
import type { SlotSpinResult } from '../tipler/SlotTipleri';
import {
  oyunEdgeJsonCagir,
  oyunHataKullaniciMesaji,
  oyunRpcRetryIle,
} from '../../ortak/servisler/OyunAgIstek';

export type SpinApiError = {
  ok: false;
  hata: string;
  code?: string;
  retryable?: boolean;
};

export type SpinApiOk = { ok: true; data: SlotSpinResult };

export type UnfinishedSlotRound = {
  roundId: string;
  result: SlotSpinResult;
  status: 'pending_playback' | 'settled';
};

function mapResult(raw: Record<string, unknown>): SlotSpinResult {
  const r = raw as unknown as SlotSpinResult;
  return {
    ...r,
    betAmount: Number(r.betAmount ?? 0),
    winAmount: Number(r.winAmount ?? 0),
    balanceBefore: Number(r.balanceBefore ?? 0),
    balanceAfter: Number(r.balanceAfter ?? 0),
    scatterCount: Number(r.scatterCount ?? 0),
    bonusSpinsAwarded: Number(r.bonusSpinsAwarded ?? 0),
    remainingBonusSpins: Number(r.remainingBonusSpins ?? 0),
    winMultiplier: Number(r.winMultiplier ?? 0),
    bonusTriggered: r.bonusTriggered === true,
    isBonusSpin: r.isBonusSpin === true,
    lineWins: Array.isArray(r.lineWins) ? r.lineWins : [],
    wildPositions: Array.isArray(r.wildPositions) ? r.wildPositions : [],
    grid: (r.grid as SlotSpinResult['grid']) ?? [],
  };
}

async function recoverSpinByKey(
  idempotencyKey: string,
): Promise<SlotSpinResult | null> {
  const { data, error } = await oyunRpcRetryIle(() =>
    supabase.rpc('nox_round_by_idempotency', { p_key: idempotencyKey }),
  );
  if (error || !data) {
    const unfinished = await restoreUnfinishedSlotRound();
    return unfinished?.result ?? null;
  }
  const row = data as {
    result_snapshot?: Record<string, unknown>;
  };
  if (!row.result_snapshot) return null;
  return mapResult(row.result_snapshot);
}

export async function requestSlotSpin(req: {
  betAmount: number;
  idempotencyKey: string;
  roomId?: string | null;
  adminTest?: boolean;
}): Promise<SpinApiOk | SpinApiError> {
  const cagri = await oyunEdgeJsonCagir('nox-reels-spin', {
    betAmount: req.betAmount,
    idempotencyKey: req.idempotencyKey,
    roomId: req.roomId ?? null,
    adminTest: req.adminTest === true,
  });

  if (!('data' in cagri)) {
    if (cagri.retryable || cagri.code === 'network' || cagri.code === 'internal') {
      const recovered = await recoverSpinByKey(req.idempotencyKey);
      if (recovered) return { ok: true, data: recovered };
    }
    return {
      ok: false,
      hata: oyunHataKullaniciMesaji(cagri.hata, cagri.code),
      code: cagri.code,
      retryable: cagri.retryable,
    };
  }

  const payload = cagri.data as {
    error?: string;
    code?: string;
    result?: Record<string, unknown>;
  } | null;

  if (payload?.error || !payload?.result) {
    if (payload?.error) {
      const recovered = await recoverSpinByKey(req.idempotencyKey);
      if (recovered) return { ok: true, data: recovered };
    }
    return {
      ok: false,
      hata: oyunHataKullaniciMesaji(
        payload?.error ?? 'Sunucu sonucu boş',
        payload?.code,
      ),
      code: payload?.code,
      retryable: !payload?.code || payload.code === 'internal',
    };
  }

  return { ok: true, data: mapResult(payload.result) };
}

export async function warmupSlotSpin(): Promise<void> {
  try {
    await oyunEdgeJsonCagir(
      'nox-reels-spin',
      { ping: true },
      { deneme: 2, timeoutMs: 6_000 },
    );
  } catch {
    /* ısındırma kilitlemesin */
  }
}

export async function restoreUnfinishedSlotRound(): Promise<UnfinishedSlotRound | null> {
  const { data, error } = await oyunRpcRetryIle(() =>
    supabase.rpc('nox_unfinished_round'),
  );
  if (error || !data) return null;
  const row = data as {
    round_id: string;
    result_snapshot: Record<string, unknown>;
    status: string;
  };
  if (!row.result_snapshot) return null;
  const result = mapResult(row.result_snapshot);
  if (!result.mathVersion?.startsWith('nox')) return null;
  return {
    roundId: row.round_id,
    result,
    status: row.status === 'settled' ? 'settled' : 'pending_playback',
  };
}

export async function markSlotRoundPlayed(roundId: string): Promise<void> {
  if (!roundId) return;
  await oyunRpcRetryIle(() =>
    supabase.rpc('nox_mark_played', { p_round_id: roundId }),
  );
}

export function newSlotIdempotencyKey(): string {
  const rastgele =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `nox_${rastgele}`;
}
