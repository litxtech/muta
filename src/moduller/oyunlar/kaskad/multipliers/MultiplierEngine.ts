/**
 * Multiplier toplama — cascade boyunca biriken çarpanlar.
 */

import { collectSpecials } from '../grid/GridGenerator';
import type { GridMatrix } from '../tipler/KaskadTipleri';

export function extractActiveMultipliers(grid: GridMatrix): number[] {
  const { multipliers } = collectSpecials(grid);
  return multipliers
    .map((c) => c.multiplierValue ?? 0)
    .filter((v) => v > 0)
    .sort((a, b) => a - b);
}

/** Toplam çarpan: tüm cascade adımlarındaki orb değerlerinin toplamı (min 1) */
export function sumMultipliers(values: readonly number[]): number {
  if (values.length === 0) return 1;
  return values.reduce((a, b) => a + b, 0);
}

/** Adım çarpanı: bu cascade'teki orb toplamı; yoksa 1. Final = Σ(stepWin × stepMult) */
export function applyStepMultiplier(stepWin: number, stepMults: readonly number[]): number {
  if (stepWin <= 0) return 0;
  const mult = stepMults.length === 0 ? 1 : stepMults.reduce((a, b) => a + b, 0);
  return Math.floor(stepWin * Math.max(1, mult) * 100) / 100;
}

export function applyMultiplierToWin(baseWin: number, totalMult: number): number {
  if (baseWin <= 0) return 0;
  const mult = Math.max(1, totalMult);
  return Math.floor(baseWin * mult * 100) / 100;
}
