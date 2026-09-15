/**
 * Özel taş üretimi ve aktivasyon.
 */

import type {
  BoardCell,
  BoardState,
  GridPos,
  MatchGroup,
  SpecialType,
  TileType,
} from '../tipler/KristalTipleri';
import {
  cloneBoard,
  emptyCell,
  getCell,
  inBounds,
  makeCell,
  posKey,
  setCell,
} from '../motor/TahtaYardimcilari';

export function specialFromMatch(group: MatchGroup): SpecialType {
  if (group.shape === 'L' || group.shape === 'T') return 'bomb';
  if (group.length >= 5) return 'color_bomb';
  if (group.length === 4) {
    const rows = new Set(group.cells.map((p) => p.row));
    return rows.size === 1 ? 'rocket_h' : 'rocket_v';
  }
  return 'none';
}

export function createSpecialCell(
  id: string,
  type: TileType,
  special: SpecialType,
): BoardCell {
  return makeCell(id, type, special);
}

export function collectActivationCells(
  board: BoardState,
  at: GridPos,
  special: SpecialType,
  partnerType?: TileType | null,
): GridPos[] {
  const out: GridPos[] = [];
  const size = board.size;

  const push = (p: GridPos) => {
    if (inBounds(p, size)) out.push(p);
  };

  switch (special) {
    case 'rocket_h':
      for (let c = 0; c < size; c++) push({ row: at.row, col: c });
      break;
    case 'rocket_v':
      for (let r = 0; r < size; r++) push({ row: r, col: at.col });
      break;
    case 'bomb':
      for (let r = at.row - 1; r <= at.row + 1; r++) {
        for (let c = at.col - 1; c <= at.col + 1; c++) {
          push({ row: r, col: c });
        }
      }
      break;
    case 'color_bomb': {
      const target =
        partnerType ??
        getCell(board, at)?.type ??
        null;
      if (!target) break;
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const cell = board.cells[r]![c]!;
          if (!cell.empty && cell.type === target) push({ row: r, col: c });
        }
      }
      push(at);
      break;
    }
    default:
      push(at);
  }

  const seen = new Set<string>();
  return out.filter((p) => {
    const k = posKey(p);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function clearPositions(
  board: BoardState,
  positions: GridPos[],
): BoardState {
  const next = cloneBoard(board);
  for (const p of positions) {
    if (!inBounds(p, next.size)) continue;
    setCell(next, p, emptyCell(`clr-${p.row}-${p.col}-${next.moveCount}`));
  }
  return next;
}

export function placeSpecialsFromMatches(
  board: BoardState,
  groups: MatchGroup[],
  preferPos?: GridPos | null,
): { board: BoardState; created: Array<{ at: GridPos; special: SpecialType; type: TileType }> } {
  const next = cloneBoard(board);
  const created: Array<{ at: GridPos; special: SpecialType; type: TileType }> = [];
  const occupied = new Set<string>();

  for (const g of groups) {
    const special = specialFromMatch(g);
    if (special === 'none') continue;
    let at = g.origin;
    if (
      preferPos &&
      g.cells.some((p) => p.row === preferPos.row && p.col === preferPos.col)
    ) {
      at = preferPos;
    }
    const key = posKey(at);
    if (occupied.has(key)) continue;
    occupied.add(key);
    const id = `sp-${next.seed}-${next.moveCount}-${at.row}-${at.col}`;
    setCell(next, at, createSpecialCell(id, g.type, special));
    created.push({ at, special, type: g.type });
  }

  return { board: next, created };
}

export const OzelTasMotoru = {
  specialFromMatch,
  createSpecialCell,
  collectActivationCells,
  clearPositions,
  placeSpecialsFromMatches,
} as const;
