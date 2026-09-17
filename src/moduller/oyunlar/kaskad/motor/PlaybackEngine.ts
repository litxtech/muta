/**
 * Client round playback state machine — server sonucunu faz faz oynatır.
 * Sonuç ÜRETMEZ; sadece deterministic timeline'ı sunar.
 */

import {
  ANTICIPATION_MS,
  DESTROY_MS,
  GRID_ROWS,
  MATCH_GLOW_MS,
  MULTIPLIER_COLLECT_MS,
  MULTIPLIER_REVEAL_MS,
  winCelebrationMs,
} from '../sabitler/KaskadSabitleri';
import {
  dropDistancesBetween,
  dropDistancesFromAbove,
  dusmeToplamMs,
  maxDusmeMesafesi,
} from '../../ortak/grid/DusmeMesafeleri';
import { isEmptyInstanceId } from '../symbols/SymbolRules';
import type {
  GridMatrix,
  KaskadPhase,
  SpinResult,
} from '../tipler/KaskadTipleri';

export type PlaybackListener = (
  phase: KaskadPhase,
  meta?: Record<string, unknown>,
) => void;

export type PlaybackController = {
  play(result: SpinResult): Promise<void>;
  cancel(): void;
  /** Kullanıcı skip: kalan bekleme süreleri kısaltılır, fazlar atlanmaz */
  skip(): void;
  getPhase(): KaskadPhase;
};

type Signal = { cancelled: boolean; skipped: boolean; wake?: () => void };

const SKIP_FACTOR = 0.15;
/** Patlama görünür olsun; gravity hemen başlasın. */
const DESTROY_THEN_DROP_MS = Math.round(DESTROY_MS * 0.42);
const SPIN_START_MS = 80;
const SCATTER_CHECK_MS = 140;
const BONUS_INTRO_MS = 2400;
const BONUS_MODE_MS = 320;
const RETRIGGER_MS = 700;
const FINALIZE_MS = 140;

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
  let phase: KaskadPhase = 'IDLE';
  const signal: Signal = { cancelled: false, skipped: false };
  const factor = opts.speedFactor ?? 1;

  const setPhase = (p: KaskadPhase, meta?: Record<string, unknown>) => {
    phase = p;
    opts.onPhase(p, meta);
  };

  return {
    getPhase: () => phase,
    cancel() {
      signal.cancelled = true;
      signal.wake?.();
      setPhase('IDLE');
    },
    skip() {
      signal.skipped = true;
      signal.wake?.();
    },
    async play(result: SpinResult) {
      signal.cancelled = false;
      signal.skipped = false;

      setPhase('SPIN_START', { roundId: result.roundId });
      await delay(SPIN_START_MS * factor, signal);
      if (signal.cancelled) return;

      const initialDrop = dropDistancesFromAbove(
        result.initialGrid,
        isEmptyInstanceId,
      );
      setPhase('SYMBOLS_DROP', {
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
        setPhase('MATCH_CHECK', {
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

        setPhase('DESTROY', { removedIds: step.removedIds });
        await delay(DESTROY_THEN_DROP_MS * factor, signal);
        if (signal.cancelled) return;

        if (step.multipliers.length > 0) {
          setPhase('MULTIPLIER_REVEAL', { multipliers: step.multipliers });
          await delay(MULTIPLIER_REVEAL_MS * factor, signal);
          if (signal.cancelled) return;

          setPhase('MULTIPLIER_COLLECT', {
            multipliers: step.multipliers,
            stepWin: step.winAmount,
          });
          await delay(MULTIPLIER_COLLECT_MS * factor, signal);
          if (signal.cancelled) return;
        }

        const dropping = dropDistancesBetween(
          prevGrid,
          step.gridAfter,
          isEmptyInstanceId,
        );
        setPhase('CASCADE', {
          cascadeIndex: step.cascadeIndex,
          gridAfter: step.gridAfter,
          newSymbols: step.newSymbols,
          dropping,
        });
        await delay(dusmeToplamMs(maxDusmeMesafesi(dropping), factor), signal);
        if (signal.cancelled) return;
        prevGrid = step.gridAfter;
      }

      // Anticipation yalnızca sonuç gerçekten bonus içeriyorsa —
      // presentation RNG sonucunu asla değiştirmez.
      if (result.bonusTriggered && !signal.skipped) {
        setPhase('ANTICIPATION', { scatterCount: result.scatterCount });
        await delay(ANTICIPATION_MS * factor, signal);
        if (signal.cancelled) return;
      }

      setPhase('SCATTER_CHECK', {
        bonusTriggered: result.bonusTriggered,
        scatterCount: result.scatterCount,
        bonus: result.bonus,
      });
      await delay(SCATTER_CHECK_MS * factor, signal);
      if (signal.cancelled) return;

      if (result.retriggered) {
        setPhase('RETRIGGER', { extraSpins: result.retriggerSpins });
        await delay(RETRIGGER_MS * factor, signal);
        if (signal.cancelled) return;
      }

      if (result.bonusTriggered) {
        setPhase('BONUS_INTRO', { bonus: result.bonus });
        await delay(BONUS_INTRO_MS * factor, signal);
        if (signal.cancelled) return;
        setPhase('BONUS_MODE', { remaining: result.remainingBonusSpins });
        await delay(BONUS_MODE_MS * factor, signal);
      }

      if (result.winTier !== 'NONE' && result.totalWin > 0) {
        setPhase('BIG_WIN', {
          tier: result.winTier,
          totalWin: result.totalWin,
          baseWin: result.baseWin,
          totalMultiplier: result.totalMultiplier,
        });
        await delay(winCelebrationMs(result.winTier) * factor, signal);
        if (signal.cancelled) return;
      }

      setPhase('FINALIZE', {
        totalWin: result.totalWin,
        balanceAfter: result.balanceAfter,
      });
      await delay(FINALIZE_MS * factor, signal);
      setPhase('IDLE');
    },
  };
}
