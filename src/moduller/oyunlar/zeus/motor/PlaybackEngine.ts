/**
 * Client round playback — server sonucunu faz faz oynatır. Sonuç üretmez.
 */

import {
  ANTICIPATION_MS,
  DESTROY_MS,
  GRID_ROWS,
  MATCH_GLOW_MS,
  MULTIPLIER_COLLECT_MS,
  SCATTER_SILENCE_MS,
  winCelebrationMs,
} from '../config/ZeusSabitleri';
import {
  dropDistancesBetween,
  dropDistancesFromAbove,
  dusmeToplamMs,
  maxDusmeMesafesi,
} from '../../ortak/grid/DusmeMesafeleri';
import { isEmptyInstanceId } from '../symbols/SymbolRules';
import type { GridMatrix, ZeusPhase, ZeusSpinResult } from '../tipler/ZeusTipleri';

export type PlaybackListener = (
  phase: ZeusPhase,
  meta?: Record<string, unknown>,
) => void;

export type PlaybackController = {
  play(result: ZeusSpinResult): Promise<void>;
  cancel(): void;
  skip(): void;
  getPhase(): ZeusPhase;
};

type Signal = {
  cancelled: boolean;
  skipped: boolean;
  wake?: () => void;
};

const SKIP_FACTOR = 0.15;
/** Patlama görünür olsun; gravity hemen başlasın (boş sütun bekletme). */
const DESTROY_THEN_DROP_MS = Math.round(DESTROY_MS * 0.42);

function delay(ms: number, signal: Signal): Promise<void> {
  return new Promise((resolve) => {
    const effective = signal.skipped ? Math.max(16, ms * SKIP_FACTOR) : ms;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(t);
      signal.wake = undefined;
      resolve();
    };
    const t = setTimeout(finish, effective);
    signal.wake = finish;
  });
}

export function createPlaybackController(opts: {
  onPhase: PlaybackListener;
  speedFactor?: number;
}): PlaybackController {
  let phase: ZeusPhase = 'READY';
  const signal: Signal = { cancelled: false, skipped: false };
  const factor = opts.speedFactor ?? 1;

  const setPhase = (p: ZeusPhase, meta?: Record<string, unknown>) => {
    phase = p;
    opts.onPhase(p, meta);
  };

  return {
    getPhase: () => phase,
    cancel() {
      signal.cancelled = true;
      signal.wake?.();
      setPhase('READY');
    },
    skip() {
      signal.skipped = true;
      signal.wake?.();
    },
    async play(result: ZeusSpinResult) {
      signal.cancelled = false;
      signal.skipped = false;

      setPhase('SPINNING', { roundId: result.roundId });
      await delay(120 * factor, signal);
      if (signal.cancelled) return;

      const initialDrop = dropDistancesFromAbove(
        result.initialGrid,
        isEmptyInstanceId,
      );
      setPhase('LANDING', {
        grid: result.initialGrid,
        dropping: initialDrop,
      });
      await delay(
        dusmeToplamMs(maxDusmeMesafesi(initialDrop) || GRID_ROWS, factor),
        signal,
      );
      if (signal.cancelled) return;

      let prevGrid: GridMatrix = result.initialGrid;

      for (const step of result.cascades) {
        setPhase('EVALUATE', {
          cascadeIndex: step.cascadeIndex,
          matched: step.matched,
        });
        await delay((MATCH_GLOW_MS / 2) * factor, signal);
        if (signal.cancelled) return;

        setPhase('WIN_HIGHLIGHT', {
          matched: step.matched,
          win: step.winAmount,
        });
        await delay(MATCH_GLOW_MS * factor, signal);
        if (signal.cancelled) return;

        setPhase('EXPLOSION', { removedIds: step.removedIds });
        await delay(DESTROY_THEN_DROP_MS * factor, signal);
        if (signal.cancelled) return;

        const dropping = dropDistancesBetween(
          prevGrid,
          step.gridAfter,
          isEmptyInstanceId,
        );
        setPhase('CASCADE', {
          grid: step.gridAfter,
          newSymbols: step.newSymbols,
          cascadeIndex: step.cascadeIndex,
          dropping,
        });
        await delay(
          dusmeToplamMs(maxDusmeMesafesi(dropping), factor),
          signal,
        );
        if (signal.cancelled) return;
        prevGrid = step.gridAfter;
      }

      if (result.appliedMultiplier > 1) {
        setPhase('MULTIPLIER', {
          orbs: result.orbValues,
          applied: result.appliedMultiplier,
          base: result.sequenceBaseWin,
          total: result.totalWin,
        });
        await delay(MULTIPLIER_COLLECT_MS * factor, signal);
        if (signal.cancelled) return;
      }

      setPhase('SCATTER_CHECK', { scatterCount: result.scatterCount });
      await delay(180 * factor, signal);
      if (signal.cancelled) return;

      if (result.bonusTriggered && result.bonus) {
        setPhase('FREE_SPIN_TRIGGER', {
          scatterCount: result.bonus.scatterCount,
          freeSpins: result.bonus.freeSpins,
        });
        await delay(SCATTER_SILENCE_MS + ANTICIPATION_MS * factor, signal);
        if (signal.cancelled) return;
      }

      if (result.retriggered) {
        setPhase('RETRIGGER', { extra: result.retriggerSpins });
        await delay(900 * factor, signal);
        if (signal.cancelled) return;
      }

      if (
        result.winTier === 'BIG' ||
        result.winTier === 'MEGA' ||
        result.winTier === 'SENSATIONAL'
      ) {
        setPhase('BIG_WIN', {
          tier: result.winTier,
          amount: result.totalWin,
        });
        await delay(winCelebrationMs(result.winTier) * factor, signal);
        if (signal.cancelled) return;
      }

      if (result.isFreeSpin || result.remainingFreeSpins > 0) {
        setPhase('FREE_SPIN', { remaining: result.remainingFreeSpins });
        await delay(280 * factor, signal);
        if (signal.cancelled) return;
      }

      setPhase('ROUND_END', { result });
      await delay(200 * factor, signal);
      if (signal.cancelled) return;
      setPhase('READY');
    },
  };
}
