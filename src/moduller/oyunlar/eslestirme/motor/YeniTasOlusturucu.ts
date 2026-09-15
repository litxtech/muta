/**
 * Boş hücreleri seeded RNG ile doldur.
 */

import type { BoardState, SeededRandom, TileType } from '../tipler/KristalTipleri';
import { BOARD_SIZE, TILE_TYPES } from '../sabitler/KristalSabitleri';
import { seededInt } from './SeedMotoru';
import { cloneBoard, makeCell } from './TahtaYardimcilari';

export function fillEmptyCells(
  board: BoardState,
  rng: SeededRandom,
  tileTypes: readonly TileType[] = TILE_TYPES,
): BoardState {
  const next = cloneBoard(board);
  const size = next.size || BOARD_SIZE;
  let gen = next.moveCount + 1;

  for (let c = 0; c < size; c++) {
    for (let r = 0; r < size; r++) {
      const cell = next.cells[r]![c]!;
      if (!cell.empty) continue;
      const type = tileTypes[seededInt(rng, tileTypes.length)]!;
      next.cells[r]![c] = makeCell(`fill-${next.seed}-${gen}-${r}-${c}`, type);
      gen += 1;
    }
  }

  return next;
}
