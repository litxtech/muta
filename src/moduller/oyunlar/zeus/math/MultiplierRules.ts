import { isEmptyInstanceId, isMultiplier } from '../symbols/SymbolRules';
import type { GridMatrix } from '../tipler/ZeusTipleri';

export function extractOrbValues(grid: GridMatrix): number[] {
  const values: number[] = [];
  for (const row of grid) {
    for (const cell of row) {
      if (isEmptyInstanceId(cell.instanceId)) continue;
      if (!isMultiplier(cell.type)) continue;
      const v = cell.multiplierValue ?? 0;
      if (v > 0) values.push(v);
    }
  }
  return values.sort((a, b) => a - b);
}

export function sumOrbs(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/**
 * Olympus kuralı:
 * - Base: tumble zinciri bitince tahtadaki orb toplamı, dizi kazancını çarpar.
 * - Free spin: yalnızca bu turda orb varsa persistent + orb toplamı uygulanır.
 *   Orb yoksa persistent kullanılmaz; pot olduğu gibi kalır.
 */
export function applySequenceMultiplier(input: {
  sequenceBaseWin: number;
  orbValues: readonly number[];
  isFreeSpin: boolean;
  persistentBefore: number;
  persistentEnabled: boolean;
}): {
  totalWin: number;
  appliedMultiplier: number;
  persistentAfter: number;
} {
  const { sequenceBaseWin, orbValues, isFreeSpin, persistentBefore, persistentEnabled } =
    input;
  const orbSum = sumOrbs(orbValues);

  if (sequenceBaseWin <= 0) {
    return {
      totalWin: 0,
      appliedMultiplier: 1,
      persistentAfter: isFreeSpin && persistentEnabled ? persistentBefore : 0,
    };
  }

  if (isFreeSpin && persistentEnabled) {
    if (orbSum > 0) {
      const persistentAfter = persistentBefore + orbSum;
      const applied = Math.max(1, persistentAfter);
      return {
        totalWin: Math.floor(sequenceBaseWin * applied * 100) / 100,
        appliedMultiplier: applied,
        persistentAfter,
      };
    }
    return {
      totalWin: sequenceBaseWin,
      appliedMultiplier: 1,
      persistentAfter: persistentBefore,
    };
  }

  const applied = orbSum > 0 ? Math.max(1, orbSum) : 1;
  return {
    totalWin: Math.floor(sequenceBaseWin * applied * 100) / 100,
    appliedMultiplier: applied,
    persistentAfter: 0,
  };
}
