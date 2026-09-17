/**
 * NOX REELS — kazanç hesaplayıcı (payline + scatter).
 * UI'dan bağımsız; edge math ile aynı kurallar.
 */

import type {
  SlotGrid,
  SlotMathConfig,
  SlotPaylineWin,
  SlotSymbolId,
} from '../tipler/SlotTipleri';
import { classifyWinTier } from '../sabitler/SlotAyarlari';

function isWild(s: SlotSymbolId): boolean {
  return s === 'WILD';
}

function isScatter(s: SlotSymbolId): boolean {
  return s === 'SCATTER';
}

function canMatch(
  cell: SlotSymbolId,
  target: SlotSymbolId,
  wildSubsScatter: boolean,
): boolean {
  if (cell === target) return true;
  if (isWild(cell)) {
    if (isScatter(target) && !wildSubsScatter) return false;
    return true;
  }
  return false;
}

/** Soldan sağa ardışık eşleşme (wild dahil). */
export function evaluatePayline(
  grid: SlotGrid,
  line: number[],
  lineIndex: number,
  config: SlotMathConfig,
  betAmount: number,
  payScale: number,
): SlotPaylineWin | null {
  const symbols: SlotSymbolId[] = line.map((row, reel) => grid[reel]![row]!);
  let base: SlotSymbolId | null = null;
  for (const s of symbols) {
    if (isScatter(s)) return null;
    if (!isWild(s)) {
      base = s;
      break;
    }
  }
  if (!base) {
    // Tümü wild
    base = 'WILD';
  }

  let count = 0;
  for (const s of symbols) {
    if (canMatch(s, base, config.wildSubstitutesScatter)) count += 1;
    else break;
  }
  if (count < 3) return null;

  const table = config.paytable[base];
  if (!table) return null;
  const key = (count >= 5 ? 5 : count === 4 ? 4 : 3) as 3 | 4 | 5;
  const mult = table[key] ?? 0;
  if (mult <= 0) return null;

  // paytable değerleri TOPLAM bahis çarpanı (her kazanan çizgi için)
  const payout = Math.round(betAmount * mult * payScale * 100) / 100;
  if (payout <= 0) return null;

  const positions = [];
  for (let reel = 0; reel < count; reel++) {
    positions.push({ reel, row: line[reel]! });
  }

  return {
    lineIndex,
    symbol: base,
    count,
    positions,
    payout,
    multiplier: mult * payScale,
  };
}

export function countScatters(grid: SlotGrid): {
  count: number;
  positions: Array<{ reel: number; row: number }>;
} {
  const positions: Array<{ reel: number; row: number }> = [];
  for (let reel = 0; reel < grid.length; reel++) {
    for (let row = 0; row < (grid[reel]?.length ?? 0); row++) {
      if (grid[reel]![row] === 'SCATTER') positions.push({ reel, row });
    }
  }
  return { count: positions.length, positions };
}

export function findWilds(
  grid: SlotGrid,
): Array<{ reel: number; row: number }> {
  const out: Array<{ reel: number; row: number }> = [];
  for (let reel = 0; reel < grid.length; reel++) {
    for (let row = 0; row < (grid[reel]?.length ?? 0); row++) {
      if (grid[reel]![row] === 'WILD') out.push({ reel, row });
    }
  }
  return out;
}

export function evaluateGrid(
  grid: SlotGrid,
  config: SlotMathConfig,
  betAmount: number,
  opts?: { isBonusSpin?: boolean },
): {
  lineWins: SlotPaylineWin[];
  winAmount: number;
  scatterCount: number;
  wildPositions: Array<{ reel: number; row: number }>;
  bonusTriggered: boolean;
  bonusSpinsAwarded: number;
  winTier: ReturnType<typeof classifyWinTier>;
  winMultiplier: number;
} {
  const payScale = opts?.isBonusSpin ? config.bonusPayMultiplier : 1;
  const lineWins: SlotPaylineWin[] = [];
  for (let i = 0; i < config.paylines.length; i++) {
    const w = evaluatePayline(
      grid,
      config.paylines[i]!,
      i,
      config,
      betAmount,
      payScale,
    );
    if (w) lineWins.push(w);
  }

  let winAmount = lineWins.reduce((s, w) => s + w.payout, 0);
  const { count: scatterCount } = countScatters(grid);
  const wildPositions = findWilds(grid);

  const bonusTriggered =
    !opts?.isBonusSpin && scatterCount >= config.scatterTriggerCount;
  const bonusSpinsAwarded = bonusTriggered ? config.bonusSpinCount : 0;

  const maxWin = betAmount * config.maxPayoutMult;
  if (winAmount > maxWin) winAmount = maxWin;
  winAmount = Math.floor(winAmount);

  const winMultiplier = betAmount > 0 ? winAmount / betAmount : 0;
  const winTier = classifyWinTier(winMultiplier, config);

  return {
    lineWins,
    winAmount,
    scatterCount,
    wildPositions,
    bonusTriggered,
    bonusSpinsAwarded,
    winTier,
    winMultiplier,
  };
}
