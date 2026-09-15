/**
 * Scatter / Portal — bonus tetikleme ve retrigger.
 */

import { collectSpecials } from '../grid/GridGenerator';
import type {
  BonusAward,
  GridMatrix,
  KaskadMathConfig,
} from '../tipler/KaskadTipleri';

export function countScatters(grid: GridMatrix): number {
  return collectSpecials(grid).scatters.length;
}

export function resolveBonusAward(
  config: KaskadMathConfig,
  scatterCount: number,
): BonusAward | null {
  if (scatterCount >= 6) {
    return { scatterCount, freeSpins: config.scatterBonus[6] };
  }
  if (scatterCount >= 5) {
    return { scatterCount, freeSpins: config.scatterBonus[5] };
  }
  if (scatterCount >= 4) {
    return { scatterCount, freeSpins: config.scatterBonus[4] };
  }
  return null;
}

export function evaluateScatterBonus(
  grid: GridMatrix,
  config: KaskadMathConfig,
): BonusAward | null {
  return resolveBonusAward(config, countScatters(grid));
}

/** Bonus sırasında retrigger: eşik üstü scatter → ek spin */
export function evaluateRetrigger(
  config: KaskadMathConfig,
  scatterCount: number,
): number {
  if (scatterCount >= config.bonus.retrigger.minScatters) {
    return config.bonus.retrigger.extraSpins;
  }
  return 0;
}
