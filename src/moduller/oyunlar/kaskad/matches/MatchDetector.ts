/**
 * Anywhere-pay match dedektörü — payline yok.
 */

import { calcClusterWin } from '../paytable/PaytableEngine';
import { participatesInMatch } from '../symbols/SymbolRules';
import type {
  GridMatrix,
  KaskadMathConfig,
  KaskadSymbolType,
  MatchedCluster,
} from '../tipler/KaskadTipleri';

export function detectMatches(
  grid: GridMatrix,
  config: KaskadMathConfig,
  betAmount: number,
): MatchedCluster[] {
  const counts = new Map<KaskadSymbolType, string[]>();

  for (const row of grid) {
    for (const cell of row) {
      if (!participatesInMatch(cell.symbolType)) continue;
      const list = counts.get(cell.symbolType) ?? [];
      list.push(cell.instanceId);
      counts.set(cell.symbolType, list);
    }
  }

  const matches: MatchedCluster[] = [];
  for (const [symbolType, cellIds] of counts) {
    const count = cellIds.length;
    if (count < config.minMatchCount) continue;
    const winAmount = calcClusterWin(config, symbolType, count, betAmount);
    const payMult = winAmount / Math.max(1, betAmount);
    matches.push({
      symbolType,
      cellIds: [...cellIds],
      count,
      payMult,
      winAmount,
    });
  }

  return matches;
}

export function hasAnyMatch(grid: GridMatrix, config: KaskadMathConfig): boolean {
  return detectMatches(grid, config, 1).length > 0;
}

export function totalMatchWin(matches: MatchedCluster[]): number {
  return matches.reduce((sum, m) => sum + m.winAmount, 0);
}
