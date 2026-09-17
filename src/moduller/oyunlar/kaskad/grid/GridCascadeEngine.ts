/**
 * Cascade motoru — sil, düşür, doldur.
 * Her kolon ayrı compact edilir; yeni semboller yukarıdan spawn olur.
 */

import type { SeededRng } from '../rng/SeededRng';
import {
  cloneGrid,
  generateCell,
  nextInstanceId,
  type GenerateCellOptions,
} from '../grid/GridGenerator';
import { LOW_SYMBOLS } from '../sabitler/KaskadSabitleri';
import {
  emptyInstanceId,
  isEmptyInstanceId,
} from '../symbols/SymbolRules';
import type {
  GridCell,
  GridMatrix,
  KaskadMathConfig,
} from '../tipler/KaskadTipleri';

export function removeCellsByInstanceIds(
  grid: GridMatrix,
  instanceIds: ReadonlySet<string>,
): GridMatrix {
  const next = cloneGrid(grid);
  for (let r = 0; r < next.length; r += 1) {
    for (let c = 0; c < (next[r]?.length ?? 0); c += 1) {
      const cell = next[r]![c]!;
      if (instanceIds.has(cell.instanceId)) {
        next[r]![c] = {
          ...cell,
          symbolType: LOW_SYMBOLS[0] ?? 'blueCrystal',
          instanceId: emptyInstanceId(r, c),
          multiplierValue: null,
        };
      }
    }
  }
  return next;
}

/**
 * Gravity: boş hücrelerin üstündekiler düşer.
 * Dönen newSymbols — yukarıdan spawn olan hücreler.
 */
export function applyGravityAndFill(
  grid: GridMatrix,
  config: KaskadMathConfig,
  rng: SeededRng,
  opts?: GenerateCellOptions,
): { grid: GridMatrix; newSymbols: GridCell[] } {
  const cols = config.columns;
  const rows = config.rows;
  const newSymbols: GridCell[] = [];
  const result: GridMatrix = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => null as unknown as GridCell),
  );

  for (let c = 0; c < cols; c += 1) {
    const stack: GridCell[] = [];
    for (let r = rows - 1; r >= 0; r -= 1) {
      const cell = grid[r]![c]!;
      if (!isEmptyInstanceId(cell.instanceId)) {
        stack.push(cell);
      }
    }

    let writeRow = rows - 1;
    for (const cell of stack) {
      result[writeRow]![c] = {
        ...cell,
        row: writeRow,
        column: c,
        id: `r${writeRow}c${c}`,
      };
      writeRow -= 1;
    }

    while (writeRow >= 0) {
      const spawned = generateCell(config, rng, writeRow, c, opts);
      spawned.instanceId = nextInstanceId('n');
      result[writeRow]![c] = spawned;
      newSymbols.push(spawned);
      writeRow -= 1;
    }
  }

  return { grid: result, newSymbols };
}

export function collectRemovedIds(
  before: GridMatrix,
  matchedIds: ReadonlySet<string>,
): string[] {
  const out: string[] = [];
  for (const row of before) {
    for (const cell of row) {
      if (matchedIds.has(cell.instanceId)) out.push(cell.instanceId);
    }
  }
  return out;
}
