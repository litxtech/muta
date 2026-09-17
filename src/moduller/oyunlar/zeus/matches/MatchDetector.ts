import { calcClusterWin } from '../math/Paytable';
import { isEmptyInstanceId, participatesInMatch } from '../symbols/SymbolRules';
import type {
  GridMatrix,
  MatchedCluster,
  ZeusMathConfig,
  ZeusSymbolType,
} from '../tipler/ZeusTipleri';

export function detectMatches(
  grid: GridMatrix,
  config: ZeusMathConfig,
  betAmount: number,
): MatchedCluster[] {
  const counts = new Map<ZeusSymbolType, string[]>();

  for (const row of grid) {
    for (const cell of row) {
      if (isEmptyInstanceId(cell.instanceId)) continue;
      if (!participatesInMatch(cell.type)) continue;
      const list = counts.get(cell.type) ?? [];
      list.push(cell.instanceId);
      counts.set(cell.type, list);
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

export function hasAnyMatch(grid: GridMatrix, config: ZeusMathConfig): boolean {
  return detectMatches(grid, config, 1).length > 0;
}

export function totalMatchWin(matches: MatchedCluster[]): number {
  return matches.reduce((sum, m) => sum + m.winAmount, 0);
}
