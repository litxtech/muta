/**
 * Başlangıç tahtası — seeded, eşleşmesiz, en az bir geçerli hamle.
 */

import type { BoardState, SeededRandom, TileType } from '../tipler/KristalTipleri';
import {
  BOARD_CREATE_MAX_ATTEMPTS,
  BOARD_SIZE,
  TILE_TYPES,
} from '../sabitler/KristalSabitleri';
import { hasAnyMatch } from './EslesmeBulucu';
import { hasValidMove } from './GecerliHamleBulucu';
import { createSeededRandom, seededInt } from './SeedMotoru';
import { shuffleBoard } from './TahtaKaristirici';
import { cellIdAt, makeCell } from './TahtaYardimcilari';

function pickTypeAvoidingMatch(
  rng: SeededRandom,
  board: BoardState,
  row: number,
  col: number,
  types: readonly TileType[],
): TileType {
  const forbidden = new Set<TileType>();

  // Yatay: solda iki aynı
  if (col >= 2) {
    const a = board.cells[row]![col - 1]!;
    const b = board.cells[row]![col - 2]!;
    if (!a.empty && !b.empty && a.type === b.type) forbidden.add(a.type);
  }
  // Dikey: üstte iki aynı
  if (row >= 2) {
    const a = board.cells[row - 1]![col]!;
    const b = board.cells[row - 2]![col]!;
    if (!a.empty && !b.empty && a.type === b.type) forbidden.add(a.type);
  }

  const allowed = types.filter((t) => !forbidden.has(t));
  const pool = allowed.length > 0 ? allowed : types;
  return pool[seededInt(rng, pool.length)]!;
}

function fillBoardNoImmediateMatches(
  seed: number,
  rng: SeededRandom,
  size: number,
  types: readonly TileType[],
): BoardState {
  const cells = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => makeCell('tmp', types[0]!)),
  );

  const board: BoardState = {
    size,
    cells,
    seed,
    moveCount: 0,
    score: 0,
    combo: 0,
    highestCombo: 0,
  };

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const type = pickTypeAvoidingMatch(rng, board, r, c, types);
      board.cells[r]![c] = makeCell(cellIdAt(seed, r, c, 0), type);
    }
  }

  return board;
}

export function createBoard(
  seed: number,
  options?: { size?: number; tileTypes?: readonly TileType[] },
): BoardState {
  const size = options?.size ?? BOARD_SIZE;
  const types = options?.tileTypes ?? TILE_TYPES;
  const baseSeed = seed >>> 0;

  for (let attempt = 0; attempt < BOARD_CREATE_MAX_ATTEMPTS; attempt++) {
    const rng = createSeededRandom((baseSeed + attempt * 9973) >>> 0);
    let board = fillBoardNoImmediateMatches(baseSeed, rng, size, types);

    if (hasAnyMatch(board) || !hasValidMove(board)) {
      board = shuffleBoard(board, rng);
    }

    if (!hasAnyMatch(board) && hasValidMove(board)) {
      return board;
    }
  }

  // Son çare: seed+offset ile yeni üretim
  const rng = createSeededRandom((baseSeed ^ 0x9e3779b9) >>> 0);
  let board = fillBoardNoImmediateMatches(baseSeed, rng, size, types);
  board = shuffleBoard(board, rng);
  return board;
}

export function createBoardWithRng(
  seed: number,
  rng: SeededRandom,
  size = BOARD_SIZE,
  types: readonly TileType[] = TILE_TYPES,
): BoardState {
  let board = fillBoardNoImmediateMatches(seed >>> 0, rng, size, types);
  if (hasAnyMatch(board) || !hasValidMove(board)) {
    board = shuffleBoard(board, rng);
  }
  return board;
}
