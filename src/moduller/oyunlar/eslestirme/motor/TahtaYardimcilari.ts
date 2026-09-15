/**
 * Tahta yardımcıları — clone, hücre erişimi, boş hücre.
 * Motor içi paylaşılan saf yardımcılar.
 */

import type { BoardCell, BoardState, GridPos, TileType } from '../tipler/KristalTipleri';
import { BOARD_SIZE } from '../sabitler/KristalSabitleri';

let cellSeq = 0;

export function nextCellId(prefix = 'c'): string {
  cellSeq += 1;
  return `${prefix}${cellSeq}`;
}

/** Deterministik id (seed tabanlı tahta üretimi için) */
export function cellIdAt(seed: number, row: number, col: number, gen = 0): string {
  return `s${seed >>> 0}-r${row}c${col}g${gen}`;
}

export function emptyCell(id: string): BoardCell {
  return {
    id,
    type: 'diamond',
    special: 'none',
    empty: true,
  };
}

export function makeCell(
  id: string,
  type: TileType,
  special: BoardCell['special'] = 'none',
): BoardCell {
  return { id, type, special, empty: false };
}

export function inBounds(pos: GridPos, size = BOARD_SIZE): boolean {
  return pos.row >= 0 && pos.col >= 0 && pos.row < size && pos.col < size;
}

export function getCell(board: BoardState, pos: GridPos): BoardCell | null {
  if (!inBounds(pos, board.size)) return null;
  return board.cells[pos.row]![pos.col] ?? null;
}

export function setCell(board: BoardState, pos: GridPos, cell: BoardCell): void {
  board.cells[pos.row]![pos.col] = cell;
}

export function cloneBoard(board: BoardState): BoardState {
  return {
    ...board,
    cells: board.cells.map((row) => row.map((c) => ({ ...c }))),
  };
}

export function createEmptyGrid(size: number): BoardCell[][] {
  const cells: BoardCell[][] = [];
  for (let r = 0; r < size; r++) {
    const row: BoardCell[] = [];
    for (let c = 0; c < size; c++) {
      row.push(emptyCell(`e-${r}-${c}`));
    }
    cells.push(row);
  }
  return cells;
}

export function forEachCell(
  board: BoardState,
  fn: (cell: BoardCell, pos: GridPos) => void,
): void {
  for (let r = 0; r < board.size; r++) {
    for (let c = 0; c < board.size; c++) {
      fn(board.cells[r]![c]!, { row: r, col: c });
    }
  }
}

export function posKey(pos: GridPos): string {
  return `${pos.row},${pos.col}`;
}
