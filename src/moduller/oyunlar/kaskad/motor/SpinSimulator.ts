/**
 * Tam tur simülatörü — sunucu otoritesinin TypeScript aynası.
 * Production'da client bunu ÇAĞIRMAZ; Edge Function server'da aynı kuralları koşar.
 * Simülatör + unit test + kalibrasyon bu modülü kullanır.
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
import { detectMatches, totalMatchWin } from '../matches/MatchDetector';
import {
  applyStepMultiplier,
  collectMultiplierInstanceIds,
  extractActiveMultipliers,
  sumMultipliers,
} from '../multipliers/MultiplierEngine';
import { resolveWinTier } from '../paytable/PaytableEngine';
import { createSeededRng } from '../rng/SeededRng';
import {
  countScatters,
  evaluateRetrigger,
  evaluateScatterBonus,
} from '../scatter/ScatterEngine';
import type {
  CascadeStep,
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
  /** Bonus boyunca taşınan kalıcı çarpan */
  persistentMultiplier?: number;
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
    persistentMultiplier = 0,
  } = input;

  resetInstanceCounter(0);
  const rng = createSeededRng(seed);
  const genOpts = { bonusMode: isBonusSpin };

  const initialGrid = generateInitialGrid(config, rng, genOpts);

  const cascades: CascadeStep[] = [];
  let grid = cloneGrid(initialGrid);
  let totalWin = 0;
  let baseWin = 0;
  const allMults: number[] = [];
  let persistentNow =
    isBonusSpin && config.bonus.persistentMultiplier ? persistentMultiplier : 0;
  let eventCount = 0;

  for (let cascadeIndex = 0; cascadeIndex < config.maxCascades; cascadeIndex += 1) {
    // Infinite loop / event guard
    eventCount += 1;
    if (eventCount > config.maxEvents) break;

    const matched = detectMatches(grid, config, betAmount);
    if (matched.length === 0) break;

    const removedSet = new Set(matched.flatMap((m) => m.cellIds));
    const stepBase = totalMatchWin(matched);
    baseWin += stepBase;

    const multsHere = extractActiveMultipliers(grid);
    for (const v of multsHere) allMults.push(v);

    const stepWin = applyStepMultiplier(stepBase, multsHere, persistentNow);
    totalWin += stepWin;

    if (isBonusSpin && config.bonus.persistentMultiplier) {
      persistentNow += multsHere.reduce((a, b) => a + b, 0);
    }

    const gridBefore = cloneGrid(grid);
    const removedIds = collectRemovedIds(gridBefore, removedSet);
    const multInstanceIds = collectMultiplierInstanceIds(grid);
    const removeAll = new Set([...removedSet, ...multInstanceIds]);

    const afterRemove = removeCellsByInstanceIds(grid, removeAll);
    const { grid: filled, newSymbols } = applyGravityAndFill(
      afterRemove,
      config,
      rng,
      genOpts,
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

  // Max settlement guard
  const maxWin = betAmount * config.maxPayoutMult;
  if (totalWin > maxWin) totalWin = maxWin;

  const scatterCount = countScatters(grid);

  let bonusTriggered = false;
  let bonus = null;
  let retriggered = false;
  let retriggerSpins = 0;

  if (isBonusSpin) {
    retriggerSpins = evaluateRetrigger(config, scatterCount);
    retriggered = retriggerSpins > 0;
  } else {
    bonus = evaluateScatterBonus(grid, config);
    bonusTriggered = bonus != null;
  }

  const debit = isBonusSpin ? 0 : betAmount;
  const balanceAfter = Math.max(0, balanceBefore - debit + totalWin);

  const remainingAfter = isBonusSpin
    ? Math.max(0, remainingBonusSpins - 1) + retriggerSpins
    : remainingBonusSpins + (bonus?.freeSpins ?? 0);

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
    baseWin,
    totalWin,
    winTier: resolveWinTier(config, totalWin, betAmount),
    bonusTriggered,
    bonus,
    retriggered,
    retriggerSpins,
    persistentMultiplierBefore: isBonusSpin ? persistentMultiplier : 0,
    persistentMultiplierAfter: persistentNow,
    scatterCount,
    balanceAfter,
    remainingBonusSpins: remainingAfter,
    isBonusSpin,
  };
}

/** Geliştirici simülatörü tam raporu */
export type SimulationReport = {
  rounds: number;
  bonusRounds: number;
  totalWager: number;
  totalPayout: number;
  observedRtp: number;
  baseGameRtp: number;
  bonusRtp: number;
  hitRate: number;
  zeroWinRate: number;
  averageWin: number;
  medianWin: number;
  maxWin: number;
  maxWinMultiple: number;
  bonusFrequency: number;
  averageBonusPayout: number;
  averageCascades: number;
  cascadeDistribution: Record<string, number>;
  multiplierFrequency: number;
  multiplierDistribution: Record<string, number>;
  maxMultiplier: number;
  variance: number;
  standardDeviation: number;
};

/**
 * Batch simülasyon — bonus free spinler de (retrigger + persistent multiplier
 * dahil) simüle edilir; RTP bonus EV'sini içerir.
 */
type SimAccumulator = {
  runRange: (start: number, end: number) => void;
  buildReport: (rounds: number, betAmount: number) => SimulationReport;
};

function createSimAccumulator(
  config: KaskadMathConfig,
  betAmount: number,
  seedPrefix: string,
): SimAccumulator {
  let totalWager = 0;
  let totalPayout = 0;
  let basePayout = 0;
  let bonusPayout = 0;
  let hits = 0;
  let zeroWins = 0;
  let bonuses = 0;
  let bonusRounds = 0;
  let cascadeSum = 0;
  let maxWin = 0;
  let multiplierHits = 0;
  let maxMultiplier = 0;
  const wins: number[] = [];
  const cascadeDist: Record<string, number> = {};
  const multDist: Record<string, number> = {};
  const bonusPayouts: number[] = [];

  const bonusGuardSpins = 1000;

  const runOne = (i: number): void => {
    const result = simulateSpin({
      config,
      seed: `${seedPrefix}-${i}`,
      betAmount,
      roundId: `r${i}`,
      sessionId: 'sim',
      balanceBefore: Number.MAX_SAFE_INTEGER / 4,
    });

    totalWager += betAmount;
    let roundPayout = result.totalWin;
    basePayout += result.totalWin;

    const cKey = String(result.cascades.length);
    cascadeDist[cKey] = (cascadeDist[cKey] ?? 0) + 1;
    cascadeSum += result.cascades.length;

    if (result.totalMultiplier > 1) {
      multiplierHits += 1;
      if (result.totalMultiplier > maxMultiplier) {
        maxMultiplier = result.totalMultiplier;
      }
    }
    for (const step of result.cascades) {
      for (const v of step.multipliers) {
        const mKey = String(v);
        multDist[mKey] = (multDist[mKey] ?? 0) + 1;
      }
    }

    if (result.bonusTriggered && result.bonus) {
      bonuses += 1;
      let spinsLeft = result.bonus.freeSpins;
      let persistent = 0;
      let thisBonusPayout = 0;
      let spinIndex = 0;
      while (spinsLeft > 0 && spinIndex < bonusGuardSpins) {
        const bonusResult = simulateSpin({
          config,
          seed: `${seedPrefix}-${i}-b${spinIndex}`,
          betAmount,
          roundId: `r${i}b${spinIndex}`,
          sessionId: 'sim',
          balanceBefore: Number.MAX_SAFE_INTEGER / 4,
          isBonusSpin: true,
          remainingBonusSpins: spinsLeft,
          persistentMultiplier: persistent,
        });
        spinsLeft = spinsLeft - 1 + bonusResult.retriggerSpins;
        persistent = config.bonus.persistentMultiplier
          ? bonusResult.persistentMultiplierAfter
          : 0;
        thisBonusPayout += bonusResult.totalWin;
        bonusRounds += 1;
        spinIndex += 1;
      }
      bonusPayout += thisBonusPayout;
      bonusPayouts.push(thisBonusPayout);
      roundPayout += thisBonusPayout;
    }

    totalPayout += roundPayout;
    wins.push(roundPayout);
    if (roundPayout > 0) hits += 1;
    else zeroWins += 1;
    if (roundPayout > maxWin) maxWin = roundPayout;
  };

  const buildReport = (rounds: number, bet: number): SimulationReport => {
    const mean = rounds > 0 ? totalPayout / rounds : 0;
    let varianceSum = 0;
    for (const w of wins) varianceSum += (w - mean) ** 2;
    const variance = rounds > 1 ? varianceSum / (rounds - 1) : 0;

    const sorted = [...wins].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const medianWin =
      sorted.length === 0
        ? 0
        : sorted.length % 2 === 1
          ? sorted[mid]!
          : (sorted[mid - 1]! + sorted[mid]!) / 2;

    return {
      rounds,
      bonusRounds,
      totalWager,
      totalPayout,
      observedRtp: totalWager > 0 ? totalPayout / totalWager : 0,
      baseGameRtp: totalWager > 0 ? basePayout / totalWager : 0,
      bonusRtp: totalWager > 0 ? bonusPayout / totalWager : 0,
      hitRate: rounds > 0 ? hits / rounds : 0,
      zeroWinRate: rounds > 0 ? zeroWins / rounds : 0,
      averageWin: mean,
      medianWin,
      maxWin,
      maxWinMultiple: bet > 0 ? maxWin / bet : 0,
      bonusFrequency: rounds > 0 ? bonuses / rounds : 0,
      averageBonusPayout:
        bonusPayouts.length > 0
          ? bonusPayouts.reduce((a, b) => a + b, 0) / bonusPayouts.length
          : 0,
      averageCascades: rounds > 0 ? cascadeSum / rounds : 0,
      cascadeDistribution: cascadeDist,
      multiplierFrequency: rounds > 0 ? multiplierHits / rounds : 0,
      multiplierDistribution: multDist,
      maxMultiplier,
      variance,
      standardDeviation: Math.sqrt(variance),
    };
  };

  return {
    runRange: (start, end) => {
      for (let i = start; i < end; i += 1) runOne(i);
    },
    buildReport,
  };
}

export function runBatchSimulation(
  config: KaskadMathConfig,
  rounds: number,
  betAmount: number,
  seedPrefix = 'sim',
): SimulationReport {
  const acc = createSimAccumulator(config, betAmount, seedPrefix);
  acc.runRange(0, rounds);
  return acc.buildReport(rounds, betAmount);
}

/**
 * Chunk'lı asenkron simülasyon — UI thread'i kilitlemeden koşar.
 * Her chunk sonrası event loop'a döner ve ilerleme bildirir.
 */
export async function runBatchSimulationAsync(
  config: KaskadMathConfig,
  rounds: number,
  betAmount: number,
  options?: {
    seedPrefix?: string;
    chunkSize?: number;
    onProgress?: (done: number, total: number) => void;
    shouldCancel?: () => boolean;
  },
): Promise<SimulationReport> {
  const seedPrefix = options?.seedPrefix ?? 'sim';
  const chunkSize = Math.max(100, options?.chunkSize ?? 2000);
  const acc = createSimAccumulator(config, betAmount, seedPrefix);

  let done = 0;
  while (done < rounds) {
    if (options?.shouldCancel?.()) break;
    const end = Math.min(rounds, done + chunkSize);
    acc.runRange(done, end);
    done = end;
    options?.onProgress?.(done, rounds);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  return acc.buildReport(done, betAmount);
}
