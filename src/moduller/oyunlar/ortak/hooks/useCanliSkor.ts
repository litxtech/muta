/**
 * Canlı skor throttle yardımcısı — yerel skor anında, RPC seyrek.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { SCORE_THROTTLE_MS } from '../sabitler/OyunSabitleri';
import { submitGameScore } from '../servisler/OyunOturumServisi';
import type { SubmitGameScoreParams } from '../tipler/OyunTipleri';

export type CanliSkorDurumu = {
  score: number;
  moveCount: number;
  highestCombo: number;
  specialTilesUsed: number;
  boardHash: string | null;
  syncing: boolean;
  lastSyncedScore: number;
};

type Options = {
  sessionId: string | undefined;
  enabled?: boolean;
  throttleMs?: number;
  onBroadcast?: (payload: {
    score: number;
    moveCount: number;
    highestCombo: number;
  }) => void;
};

export function useCanliSkor(options: Options) {
  const {
    sessionId,
    enabled = true,
    throttleMs = SCORE_THROTTLE_MS,
    onBroadcast,
  } = options;

  const [durum, setDurum] = useState<CanliSkorDurumu>({
    score: 0,
    moveCount: 0,
    highestCombo: 0,
    specialTilesUsed: 0,
    boardHash: null,
    syncing: false,
    lastSyncedScore: 0,
  });

  const pendingRef = useRef<SubmitGameScoreParams | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onBroadcastRef = useRef(onBroadcast);
  onBroadcastRef.current = onBroadcast;

  const flush = useCallback(async () => {
    const pending = pendingRef.current;
    if (!pending || !enabled) return;
    pendingRef.current = null;
    setDurum((p) => ({ ...p, syncing: true }));
    const res = await submitGameScore(pending);
    setDurum((p) => ({
      ...p,
      syncing: false,
      lastSyncedScore: res.ok ? pending.score : p.lastSyncedScore,
    }));
    onBroadcastRef.current?.({
      score: pending.score,
      moveCount: pending.moveCount,
      highestCombo: pending.highestCombo,
    });
  }, [enabled]);

  const schedule = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void flush();
    }, throttleMs);
  }, [flush, throttleMs]);

  const updateScore = useCallback(
    (patch: {
      score: number;
      moveCount: number;
      highestCombo: number;
      specialTilesUsed?: number;
      boardHash?: string | null;
    }) => {
      setDurum((prev) => ({
        ...prev,
        score: patch.score,
        moveCount: patch.moveCount,
        highestCombo: patch.highestCombo,
        specialTilesUsed: patch.specialTilesUsed ?? prev.specialTilesUsed,
        boardHash: patch.boardHash ?? prev.boardHash,
      }));

      if (!sessionId || !enabled) return;

      pendingRef.current = {
        sessionId,
        score: patch.score,
        moveCount: patch.moveCount,
        highestCombo: patch.highestCombo,
        specialTilesUsed: patch.specialTilesUsed,
        boardHash: patch.boardHash ?? undefined,
      };
      schedule();
    },
    [enabled, schedule, sessionId],
  );

  const flushNow = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await flush();
  }, [flush]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return {
    ...durum,
    updateScore,
    flushNow,
  };
}
