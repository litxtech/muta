/**
 * Client round playback state machine — server sonucunu faz faz oynatır.
 * Sonuç ÜRETMEZ; sadece deterministic timeline'ı sunar.
 */

import {
  ANTICIPATION_MS,
  DESTROY_MS,
  DROP_MS_PER_CELL,
  MATCH_GLOW_MS,
  MULTIPLIER_COLLECT_MS,
  MULTIPLIER_REVEAL_MS,
} from '../sabitler/KaskadSabitleri';
import type { KaskadPhase, SpinResult } from '../tipler/KaskadTipleri';

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

type Signal = { cancelled: boolean; skipped: boolean };

const SKIP_FACTOR = 0.15;
const BASE_DROP_MS = DROP_MS_PER_CELL[3];
const SPIN_START_MS = 120;
const WIN_STEP_MS = 160;
const SCATTER_CHECK_MS = 180;
const BONUS_INTRO_MS = 2400;
const BONUS_MODE_MS = 400;
const RETRIGGER_MS = 900;
const FINALIZE_MS = 200;

function delay(ms: number, signal: Signal): Promise<void> {
  return new Promise((resolve) => {
    const effective = signal.skipped ? Math.max(16, ms * SKIP_FACTOR) : ms;
    const t = setTimeout(() => {
      clearInterval(iv);
      resolve();
    }, effective);
    const iv = setInterval(() => {
      if (signal.cancelled || signal.skipped) {
        clearTimeout(t);
        clearInterval(iv);
        resolve();
      }
    }, 40);
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
      setPhase('IDLE');
    },
    skip() {
      signal.skipped = true;
    },
    async play(result: SpinResult) {
      signal.cancelled = false;
      signal.skipped = false;

      setPhase('SPIN_START', { roundId: result.roundId });
      await delay(SPIN_START_MS * factor, signal);
      if (signal.cancelled) return;

      setPhase('SYMBOLS_DROP', { grid: result.initialGrid });
      await delay(BASE_DROP_MS * factor, signal);
      if (signal.cancelled) return;

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
        await delay(DESTROY_MS * factor, signal);
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

        setPhase('CASCADE', {
          cascadeIndex: step.cascadeIndex,
          gridAfter: step.gridAfter,
          newSymbols: step.newSymbols,
        });
        await delay((BASE_DROP_MS + WIN_STEP_MS) * factor, signal);
        if (signal.cancelled) return;
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
        const bigMs =
          result.winTier === 'DIVINE'
            ? 3400
            : result.winTier === 'COSMIC'
              ? 2600
              : result.winTier === 'THUNDER'
                ? 2000
                : 1400;
        await delay(bigMs * factor, signal);
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
