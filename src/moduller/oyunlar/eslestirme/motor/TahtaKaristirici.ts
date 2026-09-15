/**
 * Tahta karıştırıcı — seeded RNG ile, eşleşme yok + en az bir hamle.
 */

import type { BoardState, SeededRandom } from '../tipler/KristalTipleri';
import { BOARD_CREATE_MAX_ATTEMPTS } from '../sabitler/KristalSabitleri';
import { hasAnyMatch } from './EslesmeBulucu';
import { hasValidMove } from './GecerliHamleBulucu';
import { seededInt } from './SeedMotoru';
import { cloneBoard } from './TahtaYardimcilari';

function fisherYatesPositions(board: BoardState, rng: SeededRandom): BoardState {
  const next = cloneBoard(board);
  const flat = next.cells.flat().map((c) => ({ ...c, empty: false }));
  for (let i = flat.length - 1; i > 0; i--) {
    const j = seededInt(rng, i + 1);
    const tmp = flat[i]!;
    flat[i] = flat[j]!;
    flat[j] = tmp;
  }
  let k = 0;
  for (let r = 0; r < next.size; r++) {
    for (let c = 0; c < next.size; c++) {
      next.cells[r]![c] = flat[k++]!;
    }
  }
  return next;
}

export function shuffleBoard(board: BoardState, rng: SeededRandom): BoardState {
  let current = cloneBoard(board);
  for (let attempt = 0; attempt < BOARD_CREATE_MAX_ATTEMPTS; attempt++) {
    current = fisherYatesPositions(current, rng);
    if (!hasAnyMatch(current) && hasValidMove(current)) {
      return current;
    }
  }
  // Son deneme sonucu — çağıran yeniden seed deneyebilir
  return current;
}
