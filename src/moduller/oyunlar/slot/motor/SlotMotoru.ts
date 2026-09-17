/**
 * NOX REELS — spin simülasyonu (matematik otoritesi istemci kopyası).
 * Production sonucu YALNIZCA edge function üretir; bu dosya playback + sim için.
 */

import type { SlotGrid, SlotMathConfig, SlotSpinResult, SlotSymbolId } from '../tipler/SlotTipleri';
import { DEFAULT_MATH_CONFIG } from '../sabitler/SlotAyarlari';
import { createSeededRng } from './SeededRng';
import { evaluateGrid } from './KazancHesaplayici';

export type SimulateSlotInput = {
  config?: SlotMathConfig;
  seed: string;
  betAmount: number;
  roundId?: string;
  sessionId?: string;
  balanceBefore: number;
  remainingBonusSpins?: number;
  isBonusSpin?: boolean;
};

function stopGridFromStrips(
  config: SlotMathConfig,
  rng: ReturnType<typeof createSeededRng>,
): SlotGrid {
  const grid: SlotGrid = [];
  for (let reel = 0; reel < config.reels; reel++) {
    const strip = config.reelStrips[reel] ?? config.reelStrips[0]!;
    const stop = rng.nextInt(strip.length);
    const col: SlotSymbolId[] = [];
    for (let row = 0; row < config.rows; row++) {
      col.push(strip[(stop + row) % strip.length]!);
    }
    grid.push(col);
  }
  return grid;
}

export function simulateSlotSpin(input: SimulateSlotInput): SlotSpinResult {
  const config = input.config ?? DEFAULT_MATH_CONFIG;
  const rng = createSeededRng(input.seed);
  const isBonusSpin = input.isBonusSpin === true;
  const grid = stopGridFromStrips(config, rng);
  const evaled = evaluateGrid(grid, config, input.betAmount, { isBonusSpin });

  let remaining = Math.max(0, input.remainingBonusSpins ?? 0);
  if (isBonusSpin) remaining = Math.max(0, remaining - 1);
  if (evaled.bonusTriggered) remaining += evaled.bonusSpinsAwarded;

  const debit = isBonusSpin ? 0 : input.betAmount;
  const balanceAfter = input.balanceBefore - debit + evaled.winAmount;

  return {
    roundId: input.roundId ?? 'pending',
    sessionId: input.sessionId ?? 'pending',
    betAmount: input.betAmount,
    winAmount: evaled.winAmount,
    balanceBefore: input.balanceBefore,
    balanceAfter,
    grid,
    lineWins: evaled.lineWins,
    scatterCount: evaled.scatterCount,
    wildPositions: evaled.wildPositions,
    bonusTriggered: evaled.bonusTriggered,
    bonusSpinsAwarded: evaled.bonusSpinsAwarded,
    remainingBonusSpins: remaining,
    isBonusSpin,
    winTier: evaled.winTier,
    winMultiplier: evaled.winMultiplier,
    rngSeed: input.seed,
    mathVersion: config.mathVersion,
    configVersion: config.configVersion,
    paytableVersion: config.paytableVersion,
  };
}

export function runBatchSimulation(opts: {
  spins: number;
  betAmount: number;
  config?: SlotMathConfig;
  seedPrefix?: string;
}): {
  totalBet: number;
  totalPayout: number;
  rtp: number;
  hitFrequency: number;
  avgWin: number;
  maxWin: number;
  bonusFrequency: number;
  symbolHits: Record<string, number>;
} {
  const config = opts.config ?? DEFAULT_MATH_CONFIG;
  const spins = Math.max(1, opts.spins);
  let totalBet = 0;
  let totalPayout = 0;
  let hits = 0;
  let bonus = 0;
  let maxWin = 0;
  const symbolHits: Record<string, number> = {};
  let bonusLeft = 0;

  for (let i = 0; i < spins; i++) {
    const isBonus = bonusLeft > 0;
    if (!isBonus) totalBet += opts.betAmount;
    const result = simulateSlotSpin({
      config,
      seed: `${opts.seedPrefix ?? 'sim'}-${i}`,
      betAmount: opts.betAmount,
      balanceBefore: 1_000_000_000,
      remainingBonusSpins: bonusLeft,
      isBonusSpin: isBonus,
    });
    if (isBonus) bonusLeft = result.remainingBonusSpins;
    else if (result.bonusTriggered) {
      bonus += 1;
      bonusLeft = result.remainingBonusSpins;
    }
    totalPayout += result.winAmount;
    if (result.winAmount > 0) hits += 1;
    if (result.winAmount > maxWin) maxWin = result.winAmount;
    for (const w of result.lineWins) {
      symbolHits[w.symbol] = (symbolHits[w.symbol] ?? 0) + 1;
    }
  }

  return {
    totalBet,
    totalPayout,
    rtp: totalBet > 0 ? totalPayout / totalBet : 0,
    hitFrequency: hits / spins,
    avgWin: spins > 0 ? totalPayout / spins : 0,
    maxWin,
    bonusFrequency: bonus / spins,
    symbolHits,
  };
}
