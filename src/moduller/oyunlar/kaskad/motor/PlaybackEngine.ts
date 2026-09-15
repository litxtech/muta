/**
 * Client state machine — sonucu frame-frame oynatır; sonuç üretmez.
 */

import type { KaskadPhase, SpinResult } from '../tipler/KaskadTipleri';

export type PlaybackListener = (phase: KaskadPhase, meta?: Record<string, unknown>) => void;

export type PlaybackController = {
  play(result: SpinResult): Promise<void>;
  cancel(): void;
  getPhase(): KaskadPhase;
};

function delay(ms: number, signal: { cancelled: boolean }): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(), ms);
    const iv = setInterval(() => {
      if (signal.cancelled) {
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
  dropMs?: number;
  destroyMs?: number;
  matchGlowMs?: number;
  multiplierFlightMs?: number;
}): PlaybackController {
  let phase: KaskadPhase = 'IDLE';
  const signal = { cancelled: false };
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
    async play(result: SpinResult) {
      signal.cancelled = false;
      setPhase('SPIN_START', { roundId: result.roundId });
      await delay(120 * factor, signal);
      if (signal.cancelled) return;

      setPhase('SYMBOLS_DROP', { grid: result.initialGrid });
      await delay((opts.dropMs ?? 420) * factor, signal);
      if (signal.cancelled) return;

      for (const step of result.cascades) {
        setPhase('MATCH_CHECK', { cascadeIndex: step.cascadeIndex, matched: step.matched });
        await delay((opts.matchGlowMs ?? 220) * factor, signal);
        if (signal.cancelled) return;

        setPhase('WIN_ANIMATION', { win: step.winAmount });
        await delay(160 * factor, signal);
        if (signal.cancelled) return;

        setPhase('DESTROY', { removedIds: step.removedIds });
        await delay((opts.destroyMs ?? 280) * factor, signal);
        if (signal.cancelled) return;

        if (step.multipliers.length > 0) {
          setPhase('MULTIPLIER', { multipliers: step.multipliers });
          await delay((opts.multiplierFlightMs ?? 520) * factor, signal);
          if (signal.cancelled) return;
        }

        setPhase('CASCADE', {
          cascadeIndex: step.cascadeIndex,
          gridAfter: step.gridAfter,
          newSymbols: step.newSymbols,
        });
        await delay((opts.dropMs ?? 420) * factor, signal);
        if (signal.cancelled) return;
      }

      setPhase('SCATTER_CHECK', {
        bonusTriggered: result.bonusTriggered,
        bonus: result.bonus,
      });
      await delay(180 * factor, signal);
      if (signal.cancelled) return;

      if (result.bonusTriggered) {
        setPhase('BONUS_INTRO', { bonus: result.bonus });
        await delay(1400 * factor, signal);
        if (signal.cancelled) return;
        setPhase('BONUS_MODE', {
          remaining: result.remainingBonusSpins,
        });
        await delay(400 * factor, signal);
      }

      if (result.winTier !== 'NONE' && result.totalWin > 0) {
        setPhase('BIG_WIN', { tier: result.winTier, totalWin: result.totalWin });
        const bigMs =
          result.winTier === 'SUPERNOVA'
            ? 3200
            : result.winTier === 'GALACTIC'
              ? 2400
              : result.winTier === 'COSMIC'
                ? 1800
                : 1200;
        await delay(bigMs * factor, signal);
        if (signal.cancelled) return;
      }

      setPhase('FINALIZE', {
        totalWin: result.totalWin,
        balanceAfter: result.balanceAfter,
      });
      await delay(200 * factor, signal);
      setPhase('IDLE');
    },
  };
}
