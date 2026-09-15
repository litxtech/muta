/**
 * Geçerli hamle tarayıcı.
 */

import type { BoardState, GridPos, Move } from '../tipler/KristalTipleri';
import { areAdjacent, isValidSwap } from './HamleKontrolu';

export function findValidMoves(board: BoardState): Move[] {
  const moves: Move[] = [];
  const size = board.size;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const from: GridPos = { row: r, col: c };
      const candidates: GridPos[] = [
        { row: r, col: c + 1 },
        { row: r + 1, col: c },
      ];
      for (const to of candidates) {
        if (to.row >= size || to.col >= size) continue;
        if (!areAdjacent(from, to)) continue;
        if (isValidSwap(board, from, to)) {
          moves.push({ from, to });
        }
      }
    }
  }

  return moves;
}

export function hasValidMove(board: BoardState): boolean {
  const size = board.size;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const from: GridPos = { row: r, col: c };
      const right: GridPos = { row: r, col: c + 1 };
      const down: GridPos = { row: r + 1, col: c };
      if (c + 1 < size && isValidSwap(board, from, right)) return true;
      if (r + 1 < size && isValidSwap(board, from, down)) return true;
    }
  }
  return false;
}
