/**
 * Tam tur simülatörü — sunucu otoritesi.
 * Client production'da bunu çağırmaz; Edge Function çağırır.
 */

import {
  applyGravityAndFill,
  collectRemovedIds,
  removeCellsByInstanceIds,
} from '../grid/GridCascadeEngine';
import {
  cloneGrid,
  generateInitialGrid,
  resetInstanceCounter,
} from '../grid/GridGenerator';
import {
  detectMatches,
  totalMatchWin,
} from '../matches/MatchDetector';
import {
  applyStepMultiplier,
  extractActiveMultipliers,
  sumMultipliers,
} from '../multipliers/MultiplierEngine';
import { resolveWinTier } from '../paytable/PaytableEngine';
import { createSeededRng } from '../rng/SeededRng';
import { evaluateScatterBonus } from '../scatter/ScatterEngine';
import type {
  CascadeStep,
  GridMatrix,
  KaskadMathConfig,
  SpinResult,
} from '../tipler/KaskadTipleri';

export type SimulateSpinInput = {
  config: KaskadMathConfig;
  seed: string;
  betAmount: number;
  roundId: string;
  sessionId: string;
  balanceBefore: number;
  remainingBonusSpins?: number;
  /** Bonus turunda bahis çekilmez; balanceAfter = before + win */
  isBonusSpin?: boolean;
};

export function simulateSpin(input: SimulateSpinInput): SpinResult {
  const {
    config,
    seed,
    betAmount,
    roundId,
    sessionId,
    balanceBefore,
    remainingBonusSpins = 0,
    isBonusSpin = false,
  } = input;

  resetInstanceCounter(0);
  const rng = createSeededRng(seed);

  const initialGrid = generateInitialGrid(config, rng);

  const cascades: CascadeStep[] = [];
  let grid = cloneGrid(initialGrid);
  let totalWin = 0;
  const allMults: number[] = [];

  for (let cascadeIndex = 0; cascadeIndex < config.maxCascades; cascadeIndex += 1) {
    const matched = detectMatches(grid, config, betAmount);
    if (matched.length === 0) break;

    const removedSet = new Set(matched.flatMap((m) => m.cellIds));
    const stepBase = totalMatchWin(matched);

    const multsHere = extractActiveMultipliers(grid);
    for (const v of multsHere) allMults.push(v);

    const stepWin = applyStepMultiplier(stepBase, multsHere);
    totalWin += stepWin;

    const gridBefore = cloneGrid(grid);
    const removedIds = collectRemovedIds(gridBefore, removedSet);

    const multInstanceIds = new Set<string>();
    for (const row of grid) {
      for (const cell of row) {
        if (cell.symbolType === 'multiplierOrb' && (cell.multiplierValue ?? 0) > 0) {
          multInstanceIds.add(cell.instanceId);
        }
      }
    }
    const removeAll = new Set([...removedSet, ...multInstanceIds]);

    const afterRemove = removeCellsByInstanceIds(grid, removeAll);
    const { grid: filled, newSymbols } = applyGravityAndFill(
      afterRemove,
      config,
      rng,
    );

    cascades.push({
      cascadeIndex,
      gridBefore,
      matched,
      removedIds: [...removedIds, ...multInstanceIds],
      winAmount: stepWin,
      multipliers: multsHere,
      newSymbols,
      gridAfter: cloneGrid(filled),
    });

    grid = filled;
  }

  const totalMultiplier = allMults.length === 0 ? 1 : sumMultipliers(allMults);
  const maxWin = betAmount * config.maxPayoutMult;
  if (totalWin > maxWin) totalWin = maxWin;

  const finalBonus = evaluateScatterBonus(grid, config);

  const debit = isBonusSpin ? 0 : betAmount;
  const balanceAfter = Math.max(0, balanceBefore - debit + totalWin);

  return {
    roundId,
    sessionId,
    mathVersion: config.mathVersion,
    configVersion: config.configVersion,
    paytableVersion: config.paytableVersion,
    rngSeed: seed,
    betAmount,
    initialGrid,
    cascades,
    totalMultiplier,
    baseWin: cascades.reduce((s, c) => s + c.winAmount, 0),
    totalWin,
    winTier: resolveWinTier(config, totalWin, betAmount),
    bonusTriggered: finalBonus != null,
    bonus: finalBonus,
    balanceAfter,
    remainingBonusSpins: isBonusSpin
      ? Math.max(0, remainingBonusSpins - 1) + (finalBonus?.freeSpins ?? 0)
      : remainingBonusSpins + (finalBonus?.freeSpins ?? 0),
  };
}

/** Geliştirici simülatörü için özet */
export type SimulationReport = {
  rounds: number;
  totalWager: number;
  totalPayout: number;
  hitRate: number;
  bonusRate: number;
  averageCascade: number;
  maxWin: number;
  rtp: number;
  multiplierHits: number;
};

export function runBatchSimulation(
  config: KaskadMathConfig,
  rounds: number,
  betAmount: number,
  seedPrefix = 'sim',
): SimulationReport {
  let totalWager = 0;
  let totalPayout = 0;
  let hits = 0;
  let bonuses = 0;
  let cascadeSum = 0;
  let maxWin = 0;
  let multiplierHits = 0;

  for (let i = 0; i < rounds; i += 1) {
    const result = simulateSpin({
      config,
      seed: `${seedPrefix}-${i}`,
      betAmount,
      roundId: `r${i}`,
      sessionId: 'sim',
      balanceBefore: 1_000_000_000,
    });
    totalWager += betAmount;
    totalPayout += result.totalWin;
    if (result.totalWin > 0) hits += 1;
    if (result.bonusTriggered) bonuses += 1;
    cascadeSum += result.cascades.length;
    if (result.totalWin > maxWin) maxWin = result.totalWin;
    if (result.totalMultiplier > 1) multiplierHits += 1;
  }

  return {
    rounds,
    totalWager,
    totalPayout,
    hitRate: hits / rounds,
    bonusRate: bonuses / rounds,
    averageCascade: cascadeSum / rounds,
    maxWin,
    rtp: totalWager > 0 ? totalPayout / totalWager : 0,
    multiplierHits,
  };
}

export function serializeGrid(grid: GridMatrix): unknown {
  return grid.map((row) =>
    row.map((c) => ({
      id: c.id,
      s: c.symbolType,
      i: c.instanceId,
      m: c.multiplierValue,
      r: c.row,
      c: c.column,
    })),
  );
}
