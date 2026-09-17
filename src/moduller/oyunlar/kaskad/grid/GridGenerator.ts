/**
 * Grid üretimi ve hücre yardımcıları.
 */

import type { SeededRng } from '../rng/SeededRng';
import { ALL_PAY_SYMBOLS } from '../sabitler/KaskadSabitleri';
import {
  emptyInstanceId,
  isMultiplier,
  isScatter,
} from '../symbols/SymbolRules';
import type {
  GridCell,
  GridMatrix,
  KaskadMathConfig,
  KaskadSymbolType,
} from '../tipler/KaskadTipleri';

let instanceCounter = 0;

export function resetInstanceCounter(n = 0): void {
  instanceCounter = n;
}

export function nextInstanceId(prefix = 'c'): string {
  instanceCounter += 1;
  return `${prefix}_${instanceCounter.toString(36)}`;
}

export function createEmptyGrid(cols: number, rows: number): GridMatrix {
  const grid: GridMatrix = [];
  for (let r = 0; r < rows; r += 1) {
    const row: GridCell[] = [];
    for (let c = 0; c < cols; c += 1) {
      row.push({
        id: `r${r}c${c}`,
        symbolType: 'blueCrystal',
        row: r,
        column: c,
        instanceId: emptyInstanceId(r, c),
        multiplierValue: null,
      });
    }
    grid.push(row);
  }
  return grid;
}

export function cloneGrid(grid: GridMatrix): GridMatrix {
  return grid.map((row) => row.map((cell) => ({ ...cell })));
}

function pickPaySymbol(config: KaskadMathConfig, rng: SeededRng): KaskadSymbolType {
  const items = ALL_PAY_SYMBOLS.map((sym) => ({
    item: sym,
    weight: config.symbolWeights[sym] ?? 1,
  }));
  return rng.pickWeighted(items);
}

function pickMultiplierValue(config: KaskadMathConfig, rng: SeededRng): number {
  const items = config.multiplierWeights.map((w) => ({
    item: w.value,
    weight: w.weight,
  }));
  return rng.pickWeighted(items);
}

export type GenerateCellOptions = {
  allowSpecial?: boolean;
  /** Bonus modunda multiplier spawn şansı farklı profile kullanır */
  bonusMode?: boolean;
};

export function generateCell(
  config: KaskadMathConfig,
  rng: SeededRng,
  row: number,
  column: number,
  opts?: GenerateCellOptions,
): GridCell {
  const allowSpecial = opts?.allowSpecial !== false;
  const multiplierChance = opts?.bonusMode
    ? config.bonus.multiplierSpawnChance
    : config.multiplierSpawnChance;

  let symbolType: KaskadSymbolType = pickPaySymbol(config, rng);
  let multiplierValue: number | null = null;

  if (allowSpecial) {
    if (rng.chance(config.scatterSpawnChance)) {
      symbolType = 'portalScatter';
    } else if (rng.chance(multiplierChance)) {
      symbolType = 'stormMultiplier';
      multiplierValue = pickMultiplierValue(config, rng);
    }
  }

  return {
    id: `r${row}c${column}`,
    symbolType,
    row,
    column,
    instanceId: nextInstanceId(),
    multiplierValue,
  };
}

export function generateGrid(
  config: KaskadMathConfig,
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
  config: KaskadMathConfig,
  rng: SeededRng,
  opts?: GenerateCellOptions,
): GridMatrix {
  // Cascade slot: ilk düşüşte match olabilir — bu oyunun kazanç kaynağıdır.
  return generateGrid(config, rng, opts);
}

export function countSymbol(grid: GridMatrix, type: KaskadSymbolType): number {
  let n = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell.symbolType === type) n += 1;
    }
  }
  return n;
}

export function collectSpecials(grid: GridMatrix): {
  scatters: GridCell[];
  multipliers: GridCell[];
} {
  const scatters: GridCell[] = [];
  const multipliers: GridCell[] = [];
  for (const row of grid) {
    for (const cell of row) {
      if (isScatter(cell.symbolType)) scatters.push(cell);
      if (isMultiplier(cell.symbolType)) multipliers.push(cell);
    }
  }
  return { scatters, multipliers };
}

export function flattenGrid(grid: GridMatrix): GridCell[] {
  return grid.flat();
}
