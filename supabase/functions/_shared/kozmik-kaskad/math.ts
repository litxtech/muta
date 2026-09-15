/**
 * Kozmik Kaskad — Deno paylaşımlı matematik motoru (otorite).
 * Client ile aynı kurallar; production sonuç yalnızca burada üretilir.
 */

export type SymbolType =
  | 'crystalBlue'
  | 'crystalViolet'
  | 'crystalMint'
  | 'crystalAmber'
  | 'starCore'
  | 'cosmicEye'
  | 'galaxyOrb'
  | 'energyCrown'
  | 'portalScatter'
  | 'multiplierOrb';

export type GridCell = {
  id: string;
  symbolType: SymbolType;
  row: number;
  column: number;
  instanceId: string;
  multiplierValue: number | null;
};

export type GridMatrix = GridCell[][];

export type MathConfig = {
  mathVersion: string;
  paytableVersion: string;
  configVersion: string;
  columns: number;
  rows: number;
  minMatchCount: number;
  paytable: Partial<Record<SymbolType, { 8: number; 10: number; 12: number }>>;
  symbolWeights: Partial<Record<SymbolType, number>>;
  multiplierWeights: Array<{ value: number; weight: number }>;
  multiplierSpawnChance: number;
  scatterSpawnChance: number;
  scatterBonus: { 4: number; 5: number; 6: number };
  maxCascades: number;
  maxPayoutMult: number;
  winTiers: { energy: number; cosmic: number; galactic: number; supernova: number };
  betPresets: number[];
  minBet: number;
  maxBet: number;
};

export const DEFAULT_CONFIG: MathConfig = {
  mathVersion: 'math-v1',
  paytableVersion: 'pay-v1',
  configVersion: 'cfg-v1',
  columns: 6,
  rows: 5,
  minMatchCount: 8,
  paytable: {
    crystalBlue: { 8: 1.0, 10: 2.0, 12: 4.5 },
    crystalViolet: { 8: 1.0, 10: 2.0, 12: 4.5 },
    crystalMint: { 8: 1.2, 10: 2.5, 12: 5.5 },
    crystalAmber: { 8: 1.2, 10: 2.5, 12: 5.5 },
    starCore: { 8: 3.0, 10: 6.0, 12: 12 },
    cosmicEye: { 8: 4.0, 10: 8.0, 12: 16 },
    galaxyOrb: { 8: 5.0, 10: 10, 12: 22 },
    energyCrown: { 8: 7.0, 10: 14, 12: 30 },
  },
  symbolWeights: {
    crystalBlue: 18,
    crystalViolet: 18,
    crystalMint: 17,
    crystalAmber: 17,
    starCore: 10,
    cosmicEye: 8,
    galaxyOrb: 7,
    energyCrown: 5,
  },
  multiplierWeights: [
    { value: 2, weight: 45 },
    { value: 3, weight: 28 },
    { value: 5, weight: 14 },
    { value: 10, weight: 7 },
    { value: 25, weight: 3.5 },
    { value: 50, weight: 1.5 },
    { value: 100, weight: 1 },
  ],
  multiplierSpawnChance: 0.045,
  scatterSpawnChance: 0.04,
  scatterBonus: { 4: 10, 5: 12, 6: 15 },
  maxCascades: 32,
  maxPayoutMult: 5000,
  winTiers: { energy: 10, cosmic: 25, galactic: 50, supernova: 100 },
  betPresets: [10, 20, 50, 100, 250, 500],
  minBet: 10,
  maxBet: 5000,
};

const PAY_SYMBOLS: SymbolType[] = [
  'crystalBlue',
  'crystalViolet',
  'crystalMint',
  'crystalAmber',
  'starCore',
  'cosmicEye',
  'galaxyOrb',
  'energyCrown',
];

let instanceCounter = 0;
function nextId(prefix = 'c'): string {
  instanceCounter += 1;
  return `${prefix}_${instanceCounter.toString(36)}`;
}

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

type Rng = {
  next: () => number;
  pickWeighted: <T>(items: Array<{ item: T; weight: number }>) => T;
  chance: (p: number) => boolean;
};

function createRng(seed: string): Rng {
  const seedFn = xmur3(seed);
  let state = seedFn();
  const next = () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    pickWeighted<T>(items: Array<{ item: T; weight: number }>) {
      let total = 0;
      for (const e of items) total += Math.max(0, e.weight);
      let r = next() * total;
      for (const e of items) {
        r -= Math.max(0, e.weight);
        if (r <= 0) return e.item;
      }
      return items[items.length - 1]!.item;
    },
    chance: (p) => next() < p,
  };
}

function cloneGrid(grid: GridMatrix): GridMatrix {
  return grid.map((row) => row.map((c) => ({ ...c })));
}

function generateCell(config: MathConfig, rng: Rng, row: number, col: number): GridCell {
  let symbolType: SymbolType = rng.pickWeighted(
    PAY_SYMBOLS.map((s) => ({ item: s, weight: config.symbolWeights[s] ?? 1 })),
  );
  let multiplierValue: number | null = null;
  if (rng.chance(config.scatterSpawnChance)) {
    symbolType = 'portalScatter';
  } else if (rng.chance(config.multiplierSpawnChance)) {
    symbolType = 'multiplierOrb';
    multiplierValue = rng.pickWeighted(
      config.multiplierWeights.map((w) => ({ item: w.value, weight: w.weight })),
    );
  }
  return {
    id: `r${row}c${col}`,
    symbolType,
    row,
    column: col,
    instanceId: nextId(),
    multiplierValue,
  };
}

function generateGrid(config: MathConfig, rng: Rng): GridMatrix {
  const grid: GridMatrix = [];
  for (let r = 0; r < config.rows; r += 1) {
    const row: GridCell[] = [];
    for (let c = 0; c < config.columns; c += 1) {
      row.push(generateCell(config, rng, r, c));
    }
    grid.push(row);
  }
  return grid;
}

function payBand(count: number): 8 | 10 | 12 | null {
  if (count >= 12) return 12;
  if (count >= 10) return 10;
  if (count >= 8) return 8;
  return null;
}

function detectMatches(grid: GridMatrix, config: MathConfig, bet: number) {
  const counts = new Map<SymbolType, string[]>();
  for (const row of grid) {
    for (const cell of row) {
      if (!PAY_SYMBOLS.includes(cell.symbolType)) continue;
      const list = counts.get(cell.symbolType) ?? [];
      list.push(cell.instanceId);
      counts.set(cell.symbolType, list);
    }
  }
  const matches: Array<{
    symbolType: SymbolType;
    cellIds: string[];
    count: number;
    payMult: number;
    winAmount: number;
  }> = [];
  for (const [symbolType, cellIds] of counts) {
    const count = cellIds.length;
    if (count < config.minMatchCount) continue;
    const band = payBand(count);
    const mult = band ? (config.paytable[symbolType]?.[band] ?? 0) : 0;
    const winAmount = Math.floor(bet * mult * 100) / 100;
    matches.push({
      symbolType,
      cellIds: [...cellIds],
      count,
      payMult: mult,
      winAmount,
    });
  }
  return matches;
}

function removeAndFill(grid: GridMatrix, removeIds: Set<string>, config: MathConfig, rng: Rng) {
  const cols = config.columns;
  const rows = config.rows;
  const emptied = cloneGrid(grid);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (removeIds.has(emptied[r]![c]!.instanceId)) {
        emptied[r]![c] = {
          ...emptied[r]![c]!,
          instanceId: '__empty__',
          multiplierValue: null,
        };
      }
    }
  }
  const newSymbols: GridCell[] = [];
  const result: GridMatrix = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => null as unknown as GridCell),
  );
  for (let c = 0; c < cols; c += 1) {
    const stack: GridCell[] = [];
    for (let r = rows - 1; r >= 0; r -= 1) {
      const cell = emptied[r]![c]!;
      if (cell.instanceId !== '__empty__') stack.push(cell);
    }
    let write = rows - 1;
    for (const cell of stack) {
      result[write]![c] = { ...cell, row: write, column: c, id: `r${write}c${c}` };
      write -= 1;
    }
    while (write >= 0) {
      const spawned = generateCell(config, rng, write, c);
      spawned.instanceId = nextId('n');
      result[write]![c] = spawned;
      newSymbols.push(spawned);
      write -= 1;
    }
  }
  return { grid: result, newSymbols };
}

function winTier(config: MathConfig, totalWin: number, bet: number) {
  if (bet <= 0 || totalWin <= 0) return 'NONE';
  const ratio = totalWin / bet;
  const t = config.winTiers;
  if (ratio >= t.supernova) return 'SUPERNOVA';
  if (ratio >= t.galactic) return 'GALACTIC';
  if (ratio >= t.cosmic) return 'COSMIC';
  if (ratio >= t.energy) return 'ENERGY';
  return 'NONE';
}

export function simulateSpin(input: {
  config: MathConfig;
  seed: string;
  betAmount: number;
  roundId: string;
  sessionId: string;
  balanceBefore: number;
  remainingBonusSpins?: number;
  isBonusSpin?: boolean;
}) {
  const {
    config,
    seed,
    betAmount,
    roundId,
    sessionId,
    balanceBefore,
    remainingBonusSpins = 0,
    isBonusSpin = false,
  } = input;

  instanceCounter = 0;
  const rng = createRng(seed);

  let initialGrid = generateGrid(config, rng);
  // Cascade: ilk grid match içerebilir — yeniden deneme yok.

  const cascades: Array<Record<string, unknown>> = [];
  let grid = cloneGrid(initialGrid);
  let totalWin = 0;
  const allMults: number[] = [];

  for (let cascadeIndex = 0; cascadeIndex < config.maxCascades; cascadeIndex += 1) {
    const matched = detectMatches(grid, config, betAmount);
    if (matched.length === 0) break;
    const removedSet = new Set(matched.flatMap((m) => m.cellIds));
    const stepBase = matched.reduce((s, m) => s + m.winAmount, 0);

    const multsHere: number[] = [];
    const multIds = new Set<string>();
    for (const row of grid) {
      for (const cell of row) {
        if (cell.symbolType === 'multiplierOrb' && (cell.multiplierValue ?? 0) > 0) {
          multsHere.push(cell.multiplierValue!);
          multIds.add(cell.instanceId);
          allMults.push(cell.multiplierValue!);
        }
      }
    }

    const stepMult = multsHere.length === 0 ? 1 : multsHere.reduce((a, b) => a + b, 0);
    const stepWin = Math.floor(stepBase * Math.max(1, stepMult) * 100) / 100;
    totalWin += stepWin;

    const gridBefore = cloneGrid(grid);
    const removeAll = new Set([...removedSet, ...multIds]);
    const { grid: filled, newSymbols } = removeAndFill(grid, removeAll, config, rng);

    cascades.push({
      cascadeIndex,
      gridBefore,
      matched,
      removedIds: [...removeAll],
      winAmount: stepWin,
      multipliers: multsHere,
      newSymbols,
      gridAfter: cloneGrid(filled),
    });
    grid = filled;
  }

  const totalMultiplier = allMults.length === 0 ? 1 : allMults.reduce((a, b) => a + b, 0);
  const maxWin = betAmount * config.maxPayoutMult;
  if (totalWin > maxWin) totalWin = maxWin;

  let scatterCount = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell.symbolType === 'portalScatter') scatterCount += 1;
    }
  }
  let bonus: { scatterCount: number; freeSpins: number } | null = null;
  if (scatterCount >= 6) bonus = { scatterCount, freeSpins: config.scatterBonus[6] };
  else if (scatterCount >= 5) bonus = { scatterCount, freeSpins: config.scatterBonus[5] };
  else if (scatterCount >= 4) bonus = { scatterCount, freeSpins: config.scatterBonus[4] };

  const debit = isBonusSpin ? 0 : betAmount;
  const balanceAfter = Math.max(0, balanceBefore - debit + totalWin);

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
    totalMultiplier,
    baseWin: totalWin,
    totalWin,
    winTier: winTier(config, totalWin, betAmount),
    bonusTriggered: bonus != null,
    bonus,
    balanceAfter,
    remainingBonusSpins: isBonusSpin
      ? Math.max(0, remainingBonusSpins - 1) + (bonus?.freeSpins ?? 0)
      : remainingBonusSpins + (bonus?.freeSpins ?? 0),
  };
}
