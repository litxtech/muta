/**
 * NOX REELS — Deno matematik otoritesi.
 * Client SlotMotoru ile aynı kurallar; production sonucu YALNIZCA burada.
 */

export type SlotSymbolId =
  | 'J'
  | 'Q'
  | 'K'
  | 'A'
  | 'GEM'
  | 'RING'
  | 'CROWN'
  | 'WATCH'
  | 'DIAMOND'
  | 'ROYAL_CROWN'
  | 'WILD'
  | 'SCATTER';

export type SlotGrid = SlotSymbolId[][];

export type SlotPaylineWin = {
  lineIndex: number;
  symbol: SlotSymbolId;
  count: number;
  positions: Array<{ reel: number; row: number }>;
  payout: number;
  multiplier: number;
};

export type SlotWinTier = 'NONE' | 'NORMAL_WIN' | 'BIG_WIN' | 'MEGA_WIN' | 'EPIC_WIN';

export type SlotMathConfig = {
  mathVersion: string;
  paytableVersion: string;
  configVersion: string;
  reels: number;
  rows: number;
  reelStrips: SlotSymbolId[][];
  paylines: number[][];
  paytable: Partial<Record<SlotSymbolId, { 3: number; 4: number; 5: number }>>;
  wildSubstitutesScatter: boolean;
  scatterTriggerCount: number;
  bonusSpinCount: number;
  bonusPayMultiplier: number;
  maxPayoutMult: number;
  winTiers: { big: number; mega: number; epic: number };
  broadcastMinMultiplier: number;
  betPresets: number[];
  minBet: number;
  maxBet: number;
};

const DEFAULT_PAYLINES: number[][] = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [0, 0, 1, 0, 0],
  [2, 2, 1, 2, 2],
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
  [0, 1, 1, 1, 0],
  [2, 1, 1, 1, 2],
  [1, 0, 1, 0, 1],
  [1, 2, 1, 2, 1],
  [0, 1, 0, 1, 0],
  [2, 1, 2, 1, 2],
  [0, 2, 0, 2, 0],
  [2, 0, 2, 0, 2],
  [0, 0, 2, 0, 0],
  [2, 2, 0, 2, 2],
  [1, 1, 0, 1, 1],
];

const LOW: SlotSymbolId[] = ['J', 'Q', 'K', 'A'];
const MID: SlotSymbolId[] = ['GEM', 'RING', 'CROWN', 'WATCH'];
const HIGH: SlotSymbolId[] = ['DIAMOND', 'ROYAL_CROWN'];

function buildStrip(seedBias: number): SlotSymbolId[] {
  const strip: SlotSymbolId[] = [];
  for (let i = 0; i < 48; i++) {
    const r = (i * 17 + seedBias * 13) % 100;
    if (r < 3) strip.push('WILD');
    else if (r < 6) strip.push('SCATTER');
    else if (r < 14) strip.push(HIGH[r % HIGH.length]!);
    else if (r < 42) strip.push(MID[r % MID.length]!);
    else strip.push(LOW[r % LOW.length]!);
  }
  return strip;
}

export const DEFAULT_CONFIG: SlotMathConfig = {
  mathVersion: 'nox-math-v1',
  paytableVersion: 'nox-pay-v1',
  configVersion: 'nox-cfg-v1',
  reels: 5,
  rows: 3,
  reelStrips: [
    buildStrip(1),
    buildStrip(2),
    buildStrip(3),
    buildStrip(4),
    buildStrip(5),
  ],
  paylines: DEFAULT_PAYLINES,
  paytable: {
    J: { 3: 0.58, 4: 1.7, 5: 5.8 },
    Q: { 3: 0.58, 4: 1.7, 5: 5.8 },
    K: { 3: 0.72, 4: 2.1, 5: 7.2 },
    A: { 3: 0.88, 4: 2.6, 5: 8.8 },
    GEM: { 3: 1.15, 4: 3.5, 5: 11.5 },
    RING: { 3: 1.45, 4: 4.4, 5: 14.5 },
    CROWN: { 3: 1.75, 4: 5.8, 5: 17.5 },
    WATCH: { 3: 2.1, 4: 7.2, 5: 21 },
    DIAMOND: { 3: 3.5, 4: 11.5, 5: 35 },
    ROYAL_CROWN: { 3: 5.8, 4: 17, 5: 58 },
    WILD: { 3: 7.2, 4: 21, 5: 72 },
  },
  wildSubstitutesScatter: false,
  scatterTriggerCount: 3,
  bonusSpinCount: 10,
  bonusPayMultiplier: 1.5,
  maxPayoutMult: 2000,
  winTiers: { big: 10, mega: 25, epic: 50 },
  broadcastMinMultiplier: 8,
  betPresets: [10, 20, 50, 100, 200, 500],
  minBet: 10,
  maxBet: 500,
};

function createSeededRng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0;
  if (state === 0) state = 0x9e3779b9;
  return {
    next() {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 0x100000000;
    },
    nextInt(maxExclusive: number) {
      if (maxExclusive <= 0) return 0;
      return Math.floor(this.next() * maxExclusive);
    },
  };
}

function classifyWinTier(winMultiplier: number, config: SlotMathConfig): SlotWinTier {
  if (winMultiplier <= 0) return 'NONE';
  if (winMultiplier >= config.winTiers.epic) return 'EPIC_WIN';
  if (winMultiplier >= config.winTiers.mega) return 'MEGA_WIN';
  if (winMultiplier >= config.winTiers.big) return 'BIG_WIN';
  return 'NORMAL_WIN';
}

function canMatch(
  cell: SlotSymbolId,
  target: SlotSymbolId,
  wildSubsScatter: boolean,
): boolean {
  if (cell === target) return true;
  if (cell === 'WILD') {
    if (target === 'SCATTER' && !wildSubsScatter) return false;
    return true;
  }
  return false;
}

function evaluateGrid(
  grid: SlotGrid,
  config: SlotMathConfig,
  betAmount: number,
  isBonusSpin: boolean,
) {
  const payScale = isBonusSpin ? config.bonusPayMultiplier : 1;
  const lineWins: SlotPaylineWin[] = [];

  for (let i = 0; i < config.paylines.length; i++) {
    const line = config.paylines[i]!;
    const symbols = line.map((row, reel) => grid[reel]![row]!);
    let base: SlotSymbolId | null = null;
    let scatterOnLine = false;
    for (const s of symbols) {
      if (s === 'SCATTER') {
        scatterOnLine = true;
        break;
      }
      if (s !== 'WILD') {
        base = s;
        break;
      }
    }
    if (scatterOnLine) continue;
    if (!base) base = 'WILD';

    let count = 0;
    for (const s of symbols) {
      if (canMatch(s, base, config.wildSubstitutesScatter)) count += 1;
      else break;
    }
    if (count < 3) continue;
    const table = config.paytable[base];
    if (!table) continue;
    const key = (count >= 5 ? 5 : count === 4 ? 4 : 3) as 3 | 4 | 5;
    const mult = table[key] ?? 0;
    if (mult <= 0) continue;
    const payout = Math.round(betAmount * mult * payScale * 100) / 100;
    if (payout <= 0) continue;
    const positions = [];
    for (let reel = 0; reel < count; reel++) {
      positions.push({ reel, row: line[reel]! });
    }
    lineWins.push({
      lineIndex: i,
      symbol: base,
      count,
      positions,
      payout,
      multiplier: mult * payScale,
    });
  }

  let winAmount = lineWins.reduce((s, w) => s + w.payout, 0);
  let scatterCount = 0;
  const wildPositions: Array<{ reel: number; row: number }> = [];
  for (let reel = 0; reel < grid.length; reel++) {
    for (let row = 0; row < (grid[reel]?.length ?? 0); row++) {
      const s = grid[reel]![row]!;
      if (s === 'SCATTER') scatterCount += 1;
      if (s === 'WILD') wildPositions.push({ reel, row });
    }
  }

  const bonusTriggered = !isBonusSpin && scatterCount >= config.scatterTriggerCount;
  const bonusSpinsAwarded = bonusTriggered ? config.bonusSpinCount : 0;
  const maxWin = betAmount * config.maxPayoutMult;
  if (winAmount > maxWin) winAmount = maxWin;
  winAmount = Math.floor(winAmount);
  const winMultiplier = betAmount > 0 ? winAmount / betAmount : 0;

  return {
    lineWins,
    winAmount,
    scatterCount,
    wildPositions,
    bonusTriggered,
    bonusSpinsAwarded,
    winTier: classifyWinTier(winMultiplier, config),
    winMultiplier,
  };
}

export type SlotSpinResult = {
  roundId: string;
  sessionId: string;
  betAmount: number;
  winAmount: number;
  balanceBefore: number;
  balanceAfter: number;
  grid: SlotGrid;
  lineWins: SlotPaylineWin[];
  scatterCount: number;
  wildPositions: Array<{ reel: number; row: number }>;
  bonusTriggered: boolean;
  bonusSpinsAwarded: number;
  remainingBonusSpins: number;
  isBonusSpin: boolean;
  winTier: SlotWinTier;
  winMultiplier: number;
  rngSeed: string;
  mathVersion: string;
  configVersion: string;
  paytableVersion: string;
};

export function simulateSlotSpin(input: {
  config?: SlotMathConfig;
  seed: string;
  betAmount: number;
  roundId?: string;
  sessionId?: string;
  balanceBefore: number;
  remainingBonusSpins?: number;
  isBonusSpin?: boolean;
}): SlotSpinResult {
  const config = input.config ?? DEFAULT_CONFIG;
  const rng = createSeededRng(input.seed);
  const isBonusSpin = input.isBonusSpin === true;
  const grid: SlotGrid = [];
  for (let reel = 0; reel < config.reels; reel++) {
    const strip = config.reelStrips[reel] ?? config.reelStrips[0]!;
    const stop = rng.nextInt(strip.length);
    const col: SlotSymbolId[] = [];
    for (let row = 0; row < config.rows; row++) {
      col.push(strip[(stop + row) % strip.length]!);
    }
    grid.push(col);
  }
  const evaled = evaluateGrid(grid, config, input.betAmount, isBonusSpin);
  let remaining = Math.max(0, input.remainingBonusSpins ?? 0);
  if (isBonusSpin) remaining = Math.max(0, remaining - 1);
  if (evaled.bonusTriggered) remaining += evaled.bonusSpinsAwarded;
  const debit = isBonusSpin ? 0 : input.betAmount;
  return {
    roundId: input.roundId ?? 'pending',
    sessionId: input.sessionId ?? 'pending',
    betAmount: input.betAmount,
    winAmount: evaled.winAmount,
    balanceBefore: input.balanceBefore,
    balanceAfter: input.balanceBefore - debit + evaled.winAmount,
    grid,
    lineWins: evaled.lineWins,
    scatterCount: evaled.scatterCount,
    wildPositions: evaled.wildPositions,
    bonusTriggered: evaled.bonusTriggered,
    bonusSpinsAwarded: evaled.bonusSpinsAwarded,
    remainingBonusSpins: remaining,
    isBonusSpin,
    winTier: evaled.winTier,
    winMultiplier: evaled.winMultiplier,
    rngSeed: input.seed,
    mathVersion: config.mathVersion,
    configVersion: config.configVersion,
    paytableVersion: config.paytableVersion,
  };
}
