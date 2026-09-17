/**
 * ZEUS tur simülatörü — sunucu otoritesinin TypeScript aynası.
 * Client production'da bunu ÇAĞIRMAZ; Edge Function aynı kuralları koşar.
 *
 * Dünya algoritması (pay-anywhere tumble):
 * 1) 8+ aynı ödeyen sembol → cluster kazancı
 * 2) Kazananlar patlar; scatter ve çarpan kalır
 * 3) Gravity + üstten dolum, kazanç kalmayana kadar
 * 4) Zincir bitince tahtadaki orb'lar toplanır ve dizi kazancı çarpılır
 * 5) Free spin'de orb varsa persistent pot'a eklenir ve o pot uygulanır
 * 6) 4 Zeus scatter = 15 ücretsiz tur (config)
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
import { applySequenceMultiplier, extractOrbValues } from './MultiplierRules';
import { resolveWinTier } from './Paytable';
import { createSeededRng } from '../rng/SeededRng';
import {
  countScatters,
  evaluateRetrigger,
  resolveFreeSpinAward,
} from './ScatterRules';
import type {
  CascadeStep,
  ZeusMathConfig,
  ZeusSpinResult,
} from '../tipler/ZeusTipleri';

export type SimulateSpinInput = {
  config: ZeusMathConfig;
  seed: string;
  betAmount: number;
  roundId: string;
  sessionId: string;
  balanceBefore: number;
  remainingFreeSpins?: number;
  isFreeSpin?: boolean;
  persistentMultiplier?: number;
};

export function simulateZeusSpin(input: SimulateSpinInput): ZeusSpinResult {
  const {
    config,
    seed,
    betAmount,
    roundId,
    sessionId,
    balanceBefore,
    remainingFreeSpins = 0,
    isFreeSpin = false,
    persistentMultiplier = 0,
  } = input;

  resetInstanceCounter(0);
  const rng = createSeededRng(seed);
  const genOpts = { bonusMode: isFreeSpin };

  const initialGrid = generateInitialGrid(config, rng, genOpts);
  const cascades: CascadeStep[] = [];
  let grid = cloneGrid(initialGrid);
  let sequenceBaseWin = 0;
  let eventCount = 0;

  for (let cascadeIndex = 0; cascadeIndex < config.maxCascades; cascadeIndex += 1) {
    eventCount += 1;
    if (eventCount > config.maxEvents) break;

    const matched = detectMatches(grid, config, betAmount);
    if (matched.length === 0) break;

    const removedSet = new Set(matched.flatMap((m) => m.cellIds));
    const stepBase = totalMatchWin(matched);
    sequenceBaseWin += stepBase;

    const orbsHere = extractOrbValues(grid);
    const gridBefore = cloneGrid(grid);
    const removedIds = collectRemovedIds(gridBefore, removedSet);
    const afterRemove = removeCellsByInstanceIds(grid, removedSet);
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
      removedIds,
      winAmount: stepBase,
      multipliersOnBoard: orbsHere,
      newSymbols,
      gridAfter: cloneGrid(filled),
    });

    grid = filled;
  }

  const orbValues = extractOrbValues(grid);
  const mult = applySequenceMultiplier({
    sequenceBaseWin,
    orbValues,
    isFreeSpin,
    persistentBefore: isFreeSpin ? persistentMultiplier : 0,
    persistentEnabled: config.bonus.persistentMultiplier,
  });

  let totalWin = mult.totalWin;
  const maxWin = betAmount * config.maxPayoutMult;
  if (totalWin > maxWin) totalWin = maxWin;

  const scatterCount = countScatters(grid);
  let bonusTriggered = false;
  let bonus = null;
  let retriggered = false;
  let retriggerSpins = 0;

  if (isFreeSpin) {
    retriggerSpins = evaluateRetrigger(config, scatterCount);
    retriggered = retriggerSpins > 0;
  } else {
    bonus = resolveFreeSpinAward(config, scatterCount);
    bonusTriggered = bonus != null;
  }

  const debit = isFreeSpin ? 0 : betAmount;
  const balanceAfter = Math.max(0, balanceBefore - debit + totalWin);
  const remainingAfter = isFreeSpin
    ? Math.max(0, remainingFreeSpins - 1) + retriggerSpins
    : remainingFreeSpins + (bonus?.freeSpins ?? 0);

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
    sequenceBaseWin,
    appliedMultiplier: mult.appliedMultiplier,
    orbValues,
    totalWin,
    winTier: resolveWinTier(config, totalWin, betAmount),
    bonusTriggered,
    bonus,
    retriggered,
    retriggerSpins,
    persistentMultiplierBefore: isFreeSpin ? persistentMultiplier : 0,
    persistentMultiplierAfter: isFreeSpin ? mult.persistentAfter : 0,
    scatterCount,
    balanceBefore,
    balanceAfter,
    remainingFreeSpins: remainingAfter,
    isFreeSpin,
  };
}
