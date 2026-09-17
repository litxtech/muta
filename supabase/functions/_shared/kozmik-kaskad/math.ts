/**
 * Realm of Storms — Deno paylaşımlı matematik motoru (OTORİTE).
 * Client'taki SpinSimulator ile birebir aynı kurallar; production sonuç
 * YALNIZCA burada üretilir. Client sadece playback yapar.
 */

export type SymbolType =
  | 'blueCrystal'
  | 'greenCrystal'
  | 'purpleCrystal'
  | 'redCrystal'
  | 'goldCrystal'
  | 'stormRing'
  | 'celestialCup'
  | 'timeCore'
  | 'energyCrown'
  | 'portalScatter'
  | 'stormMultiplier';

export type GridCell = {
  id: string;
  symbolType: SymbolType;
  row: number;
  column: number;
  instanceId: string;
  multiplierValue: number | null;
};

export type GridMatrix = GridCell[][];

export type WinTier = 'NONE' | 'STORM' | 'THUNDER' | 'COSMIC' | 'DIVINE';

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
  bonus: {
    persistentMultiplier: boolean;
    multiplierSpawnChance: number;
    retrigger: { minScatters: number; extraSpins: number };
  };
  maxCascades: number;
  maxEvents: number;
  maxPayoutMult: number;
  winTiers: { storm: number; thunder: number; cosmic: number; divine: number };
  betPresets: number[];
  minBet: number;
  maxBet: number;
  autoplayEnabled: boolean;
  turboEnabled: boolean;
};

/**
 * STORM_V2 — client MATH_STORM_V2 ile senkron.
 * Production'da kaskad_math_versions'taki aktif kayıt geçerlidir.
 */
export const DEFAULT_CONFIG: MathConfig = {
  mathVersion: 'storm-v2',
  paytableVersion: 'storm-pay-v2',
  configVersion: 'storm-cfg-v2',
  columns: 6,
  rows: 5,
  minMatchCount: 8,
  paytable: {
    blueCrystal: { 8: 0.41, 10: 1.24, 12: 3.05 },
    greenCrystal: { 8: 0.41, 10: 1.24, 12: 3.05 },
    purpleCrystal: { 8: 0.61, 10: 1.5, 12: 3.75 },
    redCrystal: { 8: 0.61, 10: 1.5, 12: 3.75 },
    goldCrystal: { 8: 0.82, 10: 1.95, 12: 4.7 },
    stormRing: { 8: 1.53, 10: 3.9, 12: 9.2 },
    celestialCup: { 8: 2.22, 10: 5.9, 12: 14.6 },
    timeCore: { 8: 3.65, 10: 8.75, 12: 22.4 },
    energyCrown: { 8: 6.1, 10: 15.3, 12: 38.8 },
  },
  symbolWeights: {
    blueCrystal: 17,
    greenCrystal: 17,
    purpleCrystal: 15,
    redCrystal: 15,
    goldCrystal: 13,
    stormRing: 9,
    celestialCup: 7,
    timeCore: 5.5,
    energyCrown: 4,
  },
  multiplierWeights: [
    { value: 2, weight: 40 },
    { value: 3, weight: 24 },
    { value: 4, weight: 12 },
    { value: 5, weight: 10 },
    { value: 6, weight: 5 },
    { value: 8, weight: 3.8 },
    { value: 10, weight: 2.3 },
    { value: 15, weight: 1.15 },
    { value: 25, weight: 0.65 },
    { value: 50, weight: 0.35 },
    { value: 100, weight: 0.18 },
    { value: 250, weight: 0.05 },
    { value: 500, weight: 0.02 },
  ],
  multiplierSpawnChance: 0.028,
  scatterSpawnChance: 0.0115,
  scatterBonus: { 4: 15, 5: 20, 6: 25 },
  bonus: {
    persistentMultiplier: true,
    multiplierSpawnChance: 0.05,
    retrigger: { minScatters: 3, extraSpins: 5 },
  },
  maxCascades: 32,
  maxEvents: 256,
  maxPayoutMult: 5000,
  winTiers: { storm: 10, thunder: 25, cosmic: 50, divine: 100 },
  betPresets: [20, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
  minBet: 20,
  maxBet: 50000,
  autoplayEnabled: true,
  turboEnabled: true,
};

const LOW_SYMBOLS: SymbolType[] = [
  'blueCrystal',
  'greenCrystal',
  'purpleCrystal',
  'redCrystal',
  'goldCrystal',
];

const HIGH_SYMBOLS: SymbolType[] = [
  'stormRing',
  'celestialCup',
  'timeCore',
  'energyCrown',
];

const PAY_SYMBOLS: SymbolType[] = [...LOW_SYMBOLS, ...HIGH_SYMBOLS];

const EMPTY_INSTANCE_ID = '__empty__';

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

/** Mulberry32 — crypto seed'den beslenir; aynı seed → aynı tur */
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

function generateCell(
  config: MathConfig,
  rng: Rng,
  row: number,
  col: number,
  bonusMode: boolean,
): GridCell {
  let symbolType: SymbolType = rng.pickWeighted(
    PAY_SYMBOLS.map((s) => ({ item: s, weight: config.symbolWeights[s] ?? 1 })),
  );
  let multiplierValue: number | null = null;
  const multiplierChance = bonusMode
    ? config.bonus.multiplierSpawnChance
    : config.multiplierSpawnChance;
  if (rng.chance(config.scatterSpawnChance)) {
    symbolType = 'portalScatter';
  } else if (rng.chance(multiplierChance)) {
    symbolType = 'stormMultiplier';
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

function generateGrid(config: MathConfig, rng: Rng, bonusMode: boolean): GridMatrix {
  const grid: GridMatrix = [];
  for (let r = 0; r < config.rows; r += 1) {
    const row: GridCell[] = [];
    for (let c = 0; c < config.columns; c += 1) {
      row.push(generateCell(config, rng, r, c, bonusMode));
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

export type MatchedCluster = {
  symbolType: SymbolType;
  cellIds: string[];
  count: number;
  payMult: number;
  winAmount: number;
};

function detectMatches(
  grid: GridMatrix,
  config: MathConfig,
  bet: number,
): MatchedCluster[] {
  const counts = new Map<SymbolType, string[]>();
  for (const row of grid) {
    for (const cell of row) {
      if (!PAY_SYMBOLS.includes(cell.symbolType)) continue;
      const list = counts.get(cell.symbolType) ?? [];
      list.push(cell.instanceId);
      counts.set(cell.symbolType, list);
    }
  }
  const matches: MatchedCluster[] = [];
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

function removeAndFill(
  grid: GridMatrix,
  removeIds: Set<string>,
  config: MathConfig,
  rng: Rng,
  bonusMode: boolean,
): { grid: GridMatrix; newSymbols: GridCell[] } {
  const cols = config.columns;
  const rows = config.rows;
  const emptied = cloneGrid(grid);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (removeIds.has(emptied[r]![c]!.instanceId)) {
        emptied[r]![c] = {
          ...emptied[r]![c]!,
          instanceId: EMPTY_INSTANCE_ID,
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
      if (cell.instanceId !== EMPTY_INSTANCE_ID) stack.push(cell);
    }
    let write = rows - 1;
    for (const cell of stack) {
      result[write]![c] = { ...cell, row: write, column: c, id: `r${write}c${c}` };
      write -= 1;
    }
    while (write >= 0) {
      const spawned = generateCell(config, rng, write, c, bonusMode);
      spawned.instanceId = nextId('n');
      result[write]![c] = spawned;
      newSymbols.push(spawned);
      write -= 1;
    }
  }
  return { grid: result, newSymbols };
}

function resolveWinTier(config: MathConfig, totalWin: number, bet: number): WinTier {
  if (bet <= 0 || totalWin <= 0) return 'NONE';
  const ratio = totalWin / bet;
  const t = config.winTiers;
  if (ratio >= t.divine) return 'DIVINE';
  if (ratio >= t.cosmic) return 'COSMIC';
  if (ratio >= t.thunder) return 'THUNDER';
  if (ratio >= t.storm) return 'STORM';
  return 'NONE';
}

function countScatters(grid: GridMatrix): number {
  let n = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell.symbolType === 'portalScatter') n += 1;
    }
  }
  return n;
}

export type SimulateSpinInput = {
  config: MathConfig;
  seed: string;
  betAmount: number;
  roundId: string;
  sessionId: string;
  balanceBefore: number;
  remainingBonusSpins?: number;
  isBonusSpin?: boolean;
  persistentMultiplier?: number;
};

export function simulateSpin(input: SimulateSpinInput) {
  const {
    config,
    seed,
    betAmount,
    roundId,
    sessionId,
    balanceBefore,
    remainingBonusSpins = 0,
    isBonusSpin = false,
    persistentMultiplier = 0,
  } = input;

  instanceCounter = 0;
  const rng = createRng(seed);
  const bonusMode = isBonusSpin;

  const initialGrid = generateGrid(config, rng, bonusMode);

  const cascades: Array<Record<string, unknown>> = [];
  let grid = cloneGrid(initialGrid);
  let totalWin = 0;
  let baseWin = 0;
  const allMults: number[] = [];
  let persistentNow =
    isBonusSpin && config.bonus.persistentMultiplier ? persistentMultiplier : 0;
  let eventCount = 0;

  for (let cascadeIndex = 0; cascadeIndex < config.maxCascades; cascadeIndex += 1) {
    // Infinite loop / event guard
    eventCount += 1;
    if (eventCount > config.maxEvents) break;

    const matched = detectMatches(grid, config, betAmount);
    if (matched.length === 0) break;

    const removedSet = new Set(matched.flatMap((m) => m.cellIds));
    const stepBase = matched.reduce((s, m) => s + m.winAmount, 0);
    baseWin += stepBase;

    const multsHere: number[] = [];
    const multIds = new Set<string>();
    for (const row of grid) {
      for (const cell of row) {
        if (
          cell.symbolType === 'stormMultiplier' &&
          (cell.multiplierValue ?? 0) > 0
        ) {
          multsHere.push(cell.multiplierValue!);
          multIds.add(cell.instanceId);
          allMults.push(cell.multiplierValue!);
        }
      }
    }
    multsHere.sort((a, b) => a - b);

    const orbSum = multsHere.reduce((a, b) => a + b, 0);
    const stepMult = Math.max(1, orbSum + persistentNow);
    const stepWin = Math.floor(stepBase * stepMult * 100) / 100;
    totalWin += stepWin;

    if (isBonusSpin && config.bonus.persistentMultiplier) {
      persistentNow += orbSum;
    }

    const gridBefore = cloneGrid(grid);
    const removeAll = new Set([...removedSet, ...multIds]);
    const { grid: filled, newSymbols } = removeAndFill(
      grid,
      removeAll,
      config,
      rng,
      bonusMode,
    );

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

  // Max settlement guard
  const maxWin = betAmount * config.maxPayoutMult;
  if (totalWin > maxWin) totalWin = maxWin;

  const scatterCount = countScatters(grid);

  let bonus: { scatterCount: number; freeSpins: number } | null = null;
  let bonusTriggered = false;
  let retriggered = false;
  let retriggerSpins = 0;

  if (isBonusSpin) {
    if (scatterCount >= config.bonus.retrigger.minScatters) {
      retriggerSpins = config.bonus.retrigger.extraSpins;
      retriggered = true;
    }
  } else {
    if (scatterCount >= 6) bonus = { scatterCount, freeSpins: config.scatterBonus[6] };
    else if (scatterCount >= 5) bonus = { scatterCount, freeSpins: config.scatterBonus[5] };
    else if (scatterCount >= 4) bonus = { scatterCount, freeSpins: config.scatterBonus[4] };
    bonusTriggered = bonus != null;
  }

  const debit = isBonusSpin ? 0 : betAmount;
  const balanceAfter = Math.max(0, balanceBefore - debit + totalWin);

  const remainingAfter = isBonusSpin
    ? Math.max(0, remainingBonusSpins - 1) + retriggerSpins
    : remainingBonusSpins + (bonus?.freeSpins ?? 0);

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
    baseWin,
    totalWin,
    winTier: resolveWinTier(config, totalWin, betAmount),
    bonusTriggered,
    bonus,
    retriggered,
    retriggerSpins,
    persistentMultiplierBefore: isBonusSpin ? persistentMultiplier : 0,
    persistentMultiplierAfter: persistentNow,
    scatterCount,
    balanceAfter,
    remainingBonusSpins: remainingAfter,
    isBonusSpin,
  };
}
