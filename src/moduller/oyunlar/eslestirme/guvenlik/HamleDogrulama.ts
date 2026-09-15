/**
 * Hamle doğrulama — komşuluk + sınırlar.
 */

import type { BoardState, GridPos } from '../tipler/KristalTipleri';
import { areAdjacent } from '../motor/HamleKontrolu';
import { getCell, inBounds } from '../motor/TahtaYardimcilari';

export type MoveValidationResult = {
  ok: boolean;
  reason?: string;
};

export function validateMoveBounds(
  board: BoardState,
  from: GridPos,
  to: GridPos,
): MoveValidationResult {
  if (!inBounds(from, board.size) || !inBounds(to, board.size)) {
    return { ok: false, reason: 'out_of_bounds' };
  }
  if (!areAdjacent(from, to)) {
    return { ok: false, reason: 'not_adjacent' };
  }
  const a = getCell(board, from);
  const b = getCell(board, to);
  if (!a || !b || a.empty || b.empty) {
    return { ok: false, reason: 'empty_cell' };
  }
  return { ok: true };
}
