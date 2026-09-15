/**
 * Özel taş kombinasyonları — temizlenecek hücre listesi.
 */

import type { BoardState, GridPos, SpecialType, TileType } from '../tipler/KristalTipleri';
import { collectActivationCells } from './OzelTasMotoru';
import { getCell, inBounds, posKey } from '../motor/TahtaYardimcilari';

function unique(positions: GridPos[]): GridPos[] {
  const seen = new Set<string>();
  const out: GridPos[] = [];
  for (const p of positions) {
    const k = posKey(p);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
}

function allCells(board: BoardState): GridPos[] {
  const out: GridPos[] = [];
  for (let r = 0; r < board.size; r++) {
    for (let c = 0; c < board.size; c++) {
      out.push({ row: r, col: c });
    }
  }
  return out;
}

function rocketBothAxes(board: BoardState, at: GridPos): GridPos[] {
  return unique([
    ...collectActivationCells(board, at, 'rocket_h'),
    ...collectActivationCells(board, at, 'rocket_v'),
  ]);
}

function wideBomb(board: BoardState, at: GridPos, radius: number): GridPos[] {
  const out: GridPos[] = [];
  for (let r = at.row - radius; r <= at.row + radius; r++) {
    for (let c = at.col - radius; c <= at.col + radius; c++) {
      if (inBounds({ row: r, col: c }, board.size)) {
        out.push({ row: r, col: c });
      }
    }
  }
  return out;
}

function isRocket(s: SpecialType): boolean {
  return s === 'rocket_h' || s === 'rocket_v';
}

/**
 * İki özel taşın swap kombinasyonu.
 * from/to: swap sonrası konumlar (a at `to`, b at `from` after swap — caller passes cells at positions).
 */
export function resolveSpecialCombo(
  board: BoardState,
  posA: GridPos,
  specialA: SpecialType,
  posB: GridPos,
  specialB: SpecialType,
  typeA: TileType,
  typeB: TileType,
): GridPos[] {
  // color + color → tüm tahta
  if (specialA === 'color_bomb' && specialB === 'color_bomb') {
    return allCells(board);
  }

  // color + rocket → o renkteki taşları roket gibi satır/sütun temizle
  if (
    (specialA === 'color_bomb' && isRocket(specialB)) ||
    (specialB === 'color_bomb' && isRocket(specialA))
  ) {
    const color = specialA === 'color_bomb' ? typeB : typeA;
    const rocket = isRocket(specialA) ? specialA : specialB;
    const cleared: GridPos[] = [];
    for (let r = 0; r < board.size; r++) {
      for (let c = 0; c < board.size; c++) {
        const cell = board.cells[r]![c]!;
        if (cell.empty || cell.type !== color) continue;
        cleared.push(
          ...collectActivationCells(board, { row: r, col: c }, rocket),
        );
      }
    }
    cleared.push(posA, posB);
    return unique(cleared);
  }

  // color + bomb / color + normal partner tipi
  if (specialA === 'color_bomb' || specialB === 'color_bomb') {
    const colorPos = specialA === 'color_bomb' ? posA : posB;
    const partnerType = specialA === 'color_bomb' ? typeB : typeA;
    return unique([
      ...collectActivationCells(board, colorPos, 'color_bomb', partnerType),
      posA,
      posB,
    ]);
  }

  // bomb + bomb → geniş alan
  if (specialA === 'bomb' && specialB === 'bomb') {
    return unique([
      ...wideBomb(board, posA, 2),
      ...wideBomb(board, posB, 2),
    ]);
  }

  // rocket + rocket → çapraz satır+sütun her iki noktadan
  if (isRocket(specialA) && isRocket(specialB)) {
    return unique([
      ...rocketBothAxes(board, posA),
      ...rocketBothAxes(board, posB),
    ]);
  }

  // bomb + rocket
  if (
    (specialA === 'bomb' && isRocket(specialB)) ||
    (specialB === 'bomb' && isRocket(specialA))
  ) {
    const bombPos = specialA === 'bomb' ? posA : posB;
    const rocketPos = isRocket(specialA) ? posA : posB;
    const rocket = isRocket(specialA) ? specialA : specialB;
    return unique([
      ...wideBomb(board, bombPos, 1),
      ...collectActivationCells(board, rocketPos, rocket),
      ...rocketBothAxes(board, bombPos),
    ]);
  }

  // Fallback: her birini ayrı aktive et
  return unique([
    ...collectActivationCells(board, posA, specialA, typeB),
    ...collectActivationCells(board, posB, specialB, typeA),
  ]);
}

export function activateSingleSpecial(
  board: BoardState,
  at: GridPos,
  special: SpecialType,
  partnerType?: TileType | null,
): GridPos[] {
  return collectActivationCells(board, at, special, partnerType);
}

/** Swap sonrası özel aktivasyon gerekip gerekmediği */
export function shouldActivateOnSwap(
  a: { special: SpecialType },
  b: { special: SpecialType },
): boolean {
  if (a.special !== 'none' && b.special !== 'none') return true;
  if (a.special === 'color_bomb' || b.special === 'color_bomb') return true;
  return false;
}

export function getSwapSpecialClears(
  board: BoardState,
  from: GridPos,
  to: GridPos,
): GridPos[] | null {
  const a = getCell(board, from);
  const b = getCell(board, to);
  if (!a || !b || a.empty || b.empty) return null;
  if (!shouldActivateOnSwap(a, b)) return null;

  // board burada swap sonrası olmalı
  return resolveSpecialCombo(
    board,
    from,
    a.special,
    to,
    b.special,
    a.type,
    b.type,
  );
}
