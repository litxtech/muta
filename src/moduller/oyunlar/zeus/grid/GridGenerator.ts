import type { SeededRng } from '../rng/SeededRng';
import { ALL_PAY_SYMBOLS } from '../config/ZeusSabitleri';
import { emptyInstanceId, isMultiplier, isScatter } from '../symbols/SymbolRules';
import type {
  GridCell,
  GridMatrix,
  ZeusMathConfig,
  ZeusSymbolType,
} from '../tipler/ZeusTipleri';

let instanceCounter = 0;

export function resetInstanceCounter(n = 0): void {
  instanceCounter = n;
}

export function nextInstanceId(prefix = 'c'): string {
  instanceCounter += 1;
  return `${prefix}_${instanceCounter.toString(36)}`;
}

function makeCell(
  type: ZeusSymbolType,
  row: number,
  column: number,
  instanceId: string,
  multiplierValue: number | null,
): GridCell {
  return {
    id: `r${row}c${column}`,
    type,
    column,
    row,
    x: column,
    y: row,
    scale: 1,
    rotation: 0,
    opacity: 1,
    state: 'idle',
    zIndex: 1,
    instanceId,
    multiplierValue,
  };
}

export function createEmptyGrid(cols: number, rows: number): GridMatrix {
  const grid: GridMatrix = [];
  for (let r = 0; r < rows; r += 1) {
    const row: GridCell[] = [];
    for (let c = 0; c < cols; c += 1) {
      row.push(makeCell('blueDiamond', r, c, emptyInstanceId(r, c), null));
    }
    grid.push(row);
  }
  return grid;
}

export function cloneGrid(grid: GridMatrix): GridMatrix {
  return grid.map((row) => row.map((cell) => ({ ...cell })));
}

function pickPaySymbol(config: ZeusMathConfig, rng: SeededRng): ZeusSymbolType {
  const items = ALL_PAY_SYMBOLS.map((sym) => ({
    item: sym,
    weight: config.symbolWeights[sym] ?? 1,
  }));
  return rng.pickWeighted(items);
}

function pickMultiplierValue(config: ZeusMathConfig, rng: SeededRng): number {
  const items = config.multiplierWeights.map((w) => ({
    item: w.value,
    weight: w.weight,
  }));
  return rng.pickWeighted(items);
}

export type GenerateCellOptions = {
  allowSpecial?: boolean;
  bonusMode?: boolean;
};

export function generateCell(
  config: ZeusMathConfig,
  rng: SeededRng,
  row: number,
  column: number,
  opts?: GenerateCellOptions,
): GridCell {
  const allowSpecial = opts?.allowSpecial !== false;
  const multiplierChance = opts?.bonusMode
    ? config.bonus.multiplierSpawnChance
    : config.multiplierSpawnChance;

  let type: ZeusSymbolType = pickPaySymbol(config, rng);
  let multiplierValue: number | null = null;

  if (allowSpecial) {
    if (rng.chance(config.scatterSpawnChance)) {
      type = 'zeusScatter';
    } else if (rng.chance(multiplierChance)) {
      type = 'multiplierOrb';
      multiplierValue = pickMultiplierValue(config, rng);
    }
  }

  return makeCell(type, row, column, nextInstanceId(), multiplierValue);
}

export function generateGrid(
  config: ZeusMathConfig,
  rng: SeededRng,
  opts?: GenerateCellOptions,
): GridMatrix {
  const grid: GridMatrix = [];
  for (let r = 0; r < config.rows; r += 1) {
    const row: GridCell[] = [];
    for (let c = 0; c < config.columns; c += 1) {
      row.push(generateCell(config, rng, r, c, opts));
    }
    grid.push(row);
  }
  return grid;
}

export function generateInitialGrid(
  config: ZeusMathConfig,
  rng: SeededRng,
  opts?: GenerateCellOptions,
): GridMatrix {
  return generateGrid(config, rng, opts);
}

export function flattenGrid(grid: GridMatrix): GridCell[] {
  return grid.flat();
}

export { isScatter, isMultiplier };
