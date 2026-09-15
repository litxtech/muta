/**
 * Hamle komşuluk / geçerlilik kontrolleri.
 */

import type { BoardState, GridPos } from '../tipler/KristalTipleri';
import { cloneBoard, getCell, inBounds, setCell } from './TahtaYardimcilari';
import { findMatches } from './EslesmeBulucu';

export function areAdjacent(a: GridPos, b: GridPos): boolean {
  const dr = Math.abs(a.row - b.row);
  const dc = Math.abs(a.col - b.col);
  return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
}

export function isValidSwap(board: BoardState, from: GridPos, to: GridPos): boolean {
  if (!inBounds(from, board.size) || !inBounds(to, board.size)) return false;
  if (!areAdjacent(from, to)) return false;

  const a = getCell(board, from);
  const b = getCell(board, to);
  if (!a || !b || a.empty || b.empty) return false;

  // Özel + özel veya renk bombası her zaman geçerli aktivasyon
  if (a.special !== 'none' && b.special !== 'none') return true;
  if (a.special === 'color_bomb' || b.special === 'color_bomb') return true;

  const next = cloneBoard(board);
  setCell(next, from, b);
  setCell(next, to, a);
  return findMatches(next).length > 0;
}
