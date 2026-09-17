/**
 * NOX REELS — sembol meta (asset path hazırlığı).
 * PNG gelene kadar prosedürel render kullanılır.
 */

import type { ImageSourcePropType } from 'react-native';
import type { SlotSymbolId } from '../tipler/SlotTipleri';
import { SYMBOL_DEFS } from './SlotAyarlari';

export { SYMBOL_DEFS };

/** İleride PNG: assets/nox-reels/symbols/{id}.png */
export const SYMBOL_ASSET_PATHS: Record<SlotSymbolId, string> = {
  J: 'assets/nox-reels/symbols/j.png',
  Q: 'assets/nox-reels/symbols/q.png',
  K: 'assets/nox-reels/symbols/k.png',
  A: 'assets/nox-reels/symbols/a.png',
  GEM: 'assets/nox-reels/symbols/gem.png',
  RING: 'assets/nox-reels/symbols/ring.png',
  CROWN: 'assets/nox-reels/symbols/crown.png',
  WATCH: 'assets/nox-reels/symbols/watch.png',
  DIAMOND: 'assets/nox-reels/symbols/diamond.png',
  ROYAL_CROWN: 'assets/nox-reels/symbols/royal_crown.png',
  WILD: 'assets/nox-reels/symbols/wild.png',
  SCATTER: 'assets/nox-reels/symbols/scatter.png',
};

/** Production ImageSource haritası — şimdilik boş (prosedürel). */
export const SymbolImages: Partial<Record<SlotSymbolId, ImageSourcePropType>> =
  {};

export function symbolTint(id: SlotSymbolId): string {
  return SYMBOL_DEFS[id]?.tint ?? '#FFFFFF';
}
