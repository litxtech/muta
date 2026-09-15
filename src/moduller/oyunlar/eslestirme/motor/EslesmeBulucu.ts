/**
 * Eşleşme bulucu — 3+ çizgi, L ve T şekilleri.
 */

import type { BoardState, GridPos, MatchGroup, MatchShape, TileType } from '../tipler/KristalTipleri';
import { getCell, inBounds, posKey } from './TahtaYardimcilari';

type Run = { cells: GridPos[]; type: TileType; axis: 'h' | 'v' };

function collectRuns(board: BoardState): Run[] {
  const runs: Run[] = [];
  const size = board.size;

  for (let r = 0; r < size; r++) {
    let c = 0;
    while (c < size) {
      const start = getCell(board, { row: r, col: c });
      if (!start || start.empty || start.special === 'color_bomb') {
        c += 1;
        continue;
      }
      const type = start.type;
      const cells: GridPos[] = [{ row: r, col: c }];
      let n = c + 1;
      while (n < size) {
        const cell = getCell(board, { row: r, col: n });
        if (!cell || cell.empty || cell.type !== type || cell.special === 'color_bomb') break;
        cells.push({ row: r, col: n });
        n += 1;
      }
      if (cells.length >= 3) runs.push({ cells, type, axis: 'h' });
      c = n;
    }
  }

  for (let c = 0; c < size; c++) {
    let r = 0;
    while (r < size) {
      const start = getCell(board, { row: r, col: c });
      if (!start || start.empty || start.special === 'color_bomb') {
        r += 1;
        continue;
      }
      const type = start.type;
      const cells: GridPos[] = [{ row: r, col: c }];
      let n = r + 1;
      while (n < size) {
        const cell = getCell(board, { row: n, col: c });
        if (!cell || cell.empty || cell.type !== type || cell.special === 'color_bomb') break;
        cells.push({ row: n, col: c });
        n += 1;
      }
      if (cells.length >= 3) runs.push({ cells, type, axis: 'v' });
      r = n;
    }
  }

  return runs;
}

function unionKeys(groups: GridPos[][]): Set<string> {
  const s = new Set<string>();
  for (const g of groups) for (const p of g) s.add(posKey(p));
  return s;
}

function classifyShape(cells: GridPos[]): MatchShape {
  if (cells.length < 5) {
    const rows = new Set(cells.map((p) => p.row));
    const cols = new Set(cells.map((p) => p.col));
    if (rows.size === 1 || cols.size === 1) return 'line';
  }

  const rowCounts = new Map<number, number>();
  const colCounts = new Map<number, number>();
  for (const p of cells) {
    rowCounts.set(p.row, (rowCounts.get(p.row) ?? 0) + 1);
    colCounts.set(p.col, (colCounts.get(p.col) ?? 0) + 1);
  }

  const maxRow = Math.max(...rowCounts.values());
  const maxCol = Math.max(...colCounts.values());
  const multiRows = [...rowCounts.values()].filter((v) => v >= 3).length;
  const multiCols = [...colCounts.values()].filter((v) => v >= 3).length;

  // T: bir eksende 3+, diğer eksende 3+ ve ortak merkez
  if ((maxRow >= 3 && maxCol >= 3) || (multiRows >= 1 && multiCols >= 1)) {
    // L vs T: T'de kollar her iki yöne uzar
    const pivotCandidates = cells.filter(
      (p) => (rowCounts.get(p.row) ?? 0) >= 3 && (colCounts.get(p.col) ?? 0) >= 3,
    );
    if (pivotCandidates.length > 0) {
      const pivot = pivotCandidates[0]!;
      const left = cells.some((p) => p.row === pivot.row && p.col < pivot.col);
      const right = cells.some((p) => p.row === pivot.row && p.col > pivot.col);
      const up = cells.some((p) => p.col === pivot.col && p.row < pivot.row);
      const down = cells.some((p) => p.col === pivot.col && p.row > pivot.row);
      const arms = [left, right, up, down].filter(Boolean).length;
      if (arms >= 3) return 'T';
      return 'L';
    }
  }

  const rows = new Set(cells.map((p) => p.row));
  const cols = new Set(cells.map((p) => p.col));
  if (rows.size === 1 || cols.size === 1) return 'line';
  return 'L';
}

function pickOrigin(cells: GridPos[], preferred?: GridPos | null): GridPos {
  if (preferred && cells.some((p) => p.row === preferred.row && p.col === preferred.col)) {
    return preferred;
  }
  // Merkeze en yakın
  const avgR = cells.reduce((s, p) => s + p.row, 0) / cells.length;
  const avgC = cells.reduce((s, p) => s + p.col, 0) / cells.length;
  let best = cells[0]!;
  let bestD = Infinity;
  for (const p of cells) {
    const d = Math.abs(p.row - avgR) + Math.abs(p.col - avgC);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

/**
 * Bağlantılı aynı tip koşuları birleştir (L/T için).
 */
function mergeConnectedRuns(runs: Run[]): MatchGroup[] {
  if (runs.length === 0) return [];

  // Tip bazlı
  const byType = new Map<TileType, Run[]>();
  for (const run of runs) {
    const list = byType.get(run.type) ?? [];
    list.push(run);
    byType.set(run.type, list);
  }

  const groups: MatchGroup[] = [];

  for (const [type, typeRuns] of byType) {
    const used = new Array(typeRuns.length).fill(false);

    for (let i = 0; i < typeRuns.length; i++) {
      if (used[i]) continue;
      const queue = new Set(typeRuns[i]!.cells.map(posKey));
      const cells: GridPos[] = typeRuns[i]!.cells.map((p) => ({ ...p }));
      used[i] = true;
      let grew = true;
      while (grew) {
        grew = false;
        for (let j = 0; j < typeRuns.length; j++) {
          if (used[j]) continue;
          const other = typeRuns[j]!;
          const shares = other.cells.some((p) => queue.has(posKey(p)));
          if (!shares) continue;
          for (const p of other.cells) {
            const k = posKey(p);
            if (!queue.has(k)) {
              queue.add(k);
              cells.push({ ...p });
            }
          }
          used[j] = true;
          grew = true;
        }
      }

      if (cells.length < 3) continue;
      const shape = classifyShape(cells);
      groups.push({
        cells,
        type,
        shape,
        length: cells.length,
        origin: pickOrigin(cells),
      });
    }
  }

  return groups;
}

export function findMatches(
  board: BoardState,
  preferredOrigin?: GridPos | null,
): MatchGroup[] {
  const runs = collectRuns(board);
  const groups = mergeConnectedRuns(runs);
  if (preferredOrigin) {
    return groups.map((g) => ({
      ...g,
      origin: pickOrigin(g.cells, preferredOrigin),
    }));
  }
  return groups;
}

export function hasAnyMatch(board: BoardState): boolean {
  return findMatches(board).length > 0;
}

export function allMatchedPositions(groups: MatchGroup[]): GridPos[] {
  const seen = new Set<string>();
  const out: GridPos[] = [];
  for (const g of groups) {
    for (const p of g.cells) {
      const k = posKey(p);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(p);
    }
  }
  return out;
}

export function positionsCovered(board: BoardState, positions: GridPos[]): GridPos[] {
  return positions.filter((p) => inBounds(p, board.size));
}

/** Test / debug: hücre anahtar seti */
export function matchKeySet(groups: MatchGroup[]): Set<string> {
  return unionKeys(groups.map((g) => g.cells));
}
