/**
 * İki hücreyi immutably değiştir.
 */

import type { BoardState, GridPos } from '../tipler/KristalTipleri';
import { cloneBoard, getCell, setCell } from './TahtaYardimcilari';

export function swapCells(
  board: BoardState,
  from: GridPos,
  to: GridPos,
): BoardState {
  const next = cloneBoard(board);
  const a = getCell(next, from);
  const b = getCell(next, to);
  if (!a || !b) return next;
  setCell(next, from, { ...b });
  setCell(next, to, { ...a });
  return next;
}
