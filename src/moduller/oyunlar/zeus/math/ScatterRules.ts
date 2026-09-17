import { isEmptyInstanceId, isScatter } from '../symbols/SymbolRules';
import type { BonusAward, GridMatrix, ZeusMathConfig } from '../tipler/ZeusTipleri';

export function countScatters(grid: GridMatrix): number {
  let n = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (isEmptyInstanceId(cell.instanceId)) continue;
      if (isScatter(cell.type)) n += 1;
    }
  }
  return n;
}

export function resolveFreeSpinAward(
  config: ZeusMathConfig,
  scatterCount: number,
): BonusAward | null {
  if (scatterCount >= config.freeSpinTriggerCount) {
    return { scatterCount, freeSpins: config.freeSpinReward };
  }
  return null;
}

export function evaluateRetrigger(
  config: ZeusMathConfig,
  scatterCount: number,
): number {
  if (scatterCount >= config.retriggerMinCount) {
    return config.retriggerReward;
  }
  return 0;
}
