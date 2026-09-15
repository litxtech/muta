/**
 * Yerçekimi — boş hücrelere yukarıdan taş düşür.
 */

import type { BoardState } from '../tipler/KristalTipleri';
import { cloneBoard, emptyCell } from './TahtaYardimcilari';

export function applyGravity(board: BoardState): BoardState {
  const next = cloneBoard(board);
  const size = next.size;

  for (let c = 0; c < size; c++) {
    let write = size - 1;
    for (let r = size - 1; r >= 0; r--) {
      const cell = next.cells[r]![c]!;
      if (!cell.empty) {
        if (write !== r) {
          next.cells[write]![c] = { ...cell };
          next.cells[r]![c] = emptyCell(`drop-empty-${r}-${c}-${next.moveCount}`);
        }
        write -= 1;
      }
    }
    for (let r = write; r >= 0; r--) {
      next.cells[r]![c] = emptyCell(`grav-empty-${r}-${c}-${next.moveCount}`);
    }
  }

  return next;
}
