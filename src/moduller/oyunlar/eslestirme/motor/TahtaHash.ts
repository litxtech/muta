/**
 * Deterministik tahta hash.
 */

import type { BoardState } from '../tipler/KristalTipleri';

const SPECIAL_CODE: Record<string, string> = {
  none: '0',
  rocket_h: 'H',
  rocket_v: 'V',
  bomb: 'B',
  color_bomb: 'C',
};

const TYPE_CODE: Record<string, string> = {
  diamond: 'd',
  star: 's',
  fire: 'f',
  moon: 'm',
  crown: 'k',
  bolt: 'b',
  crystal: 'c',
};

export function boardHash(board: BoardState): string {
  const parts: string[] = [`n${board.size}`];
  for (let r = 0; r < board.size; r++) {
    for (let c = 0; c < board.size; c++) {
      const cell = board.cells[r]![c]!;
      if (cell.empty) {
        parts.push('.');
        continue;
      }
      parts.push(
        `${TYPE_CODE[cell.type] ?? '?'}${SPECIAL_CODE[cell.special] ?? '?'}`,
      );
    }
  }
  // FNV-1a benzeri sıkıştırma
  const raw = parts.join('');
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `bh${(h >>> 0).toString(16)}:${raw.length}`;
}
