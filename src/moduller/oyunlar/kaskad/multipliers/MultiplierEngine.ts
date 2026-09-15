/**
 * Multiplier toplama — cascade boyunca biriken çarpanlar.
 */

import { collectSpecials } from '../grid/GridGenerator';
import { isMultiplier } from '../symbols/SymbolRules';
import type { GridMatrix } from '../tipler/KaskadTipleri';

export function extractActiveMultipliers(grid: GridMatrix): number[] {
  const { multipliers } = collectSpecials(grid);
  return multipliers
    .map((c) => c.multiplierValue ?? 0)
    .filter((v) => v > 0)
    .sort((a, b) => a - b);
}

export function collectMultiplierInstanceIds(grid: GridMatrix): Set<string> {
  const ids = new Set<string>();
  for (const row of grid) {
    for (const cell of row) {
      if (isMultiplier(cell.symbolType) && (cell.multiplierValue ?? 0) > 0) {
        ids.add(cell.instanceId);
      }
    }
  }
  return ids;
}

/** Toplam çarpan: tüm cascade adımlarındaki orb değerlerinin toplamı (min 1) */
export function sumMultipliers(values: readonly number[]): number {
  if (values.length === 0) return 1;
  return values.reduce((a, b) => a + b, 0);
}

/**
 * Adım çarpanı: bu cascade'teki orb toplamı + bonus persistent çarpanı.
 * Orb yoksa ve persistent 0 ise 1. Final = Σ(stepWin × stepMult).
 */
export function applyStepMultiplier(
  stepWin: number,
  stepMults: readonly number[],
  persistentMultiplier = 0,
): number {
  if (stepWin <= 0) return 0;
  const orbSum = stepMults.reduce((a, b) => a + b, 0);
  const mult = Math.max(1, orbSum + persistentMultiplier);
  return Math.floor(stepWin * mult * 100) / 100;
}

export function applyMultiplierToWin(baseWin: number, totalMult: number): number {
  if (baseWin <= 0) return 0;
  const mult = Math.max(1, totalMult);
  return Math.floor(baseWin * mult * 100) / 100;
}
