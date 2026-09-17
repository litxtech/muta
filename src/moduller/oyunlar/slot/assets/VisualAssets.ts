/**
 * NOX REELS — gerçek görsel asset registry.
 */

import type { ImageSourcePropType } from 'react-native';
import type { SlotSymbolId } from '../tipler/SlotTipleri';

export const SymbolImages: Record<SlotSymbolId, ImageSourcePropType> = {
  J: require('../../../../../assets/nox-reels/symbols/j.png'),
  Q: require('../../../../../assets/nox-reels/symbols/q.png'),
  K: require('../../../../../assets/nox-reels/symbols/k.png'),
  A: require('../../../../../assets/nox-reels/symbols/a.png'),
  GEM: require('../../../../../assets/nox-reels/symbols/gem.png'),
  RING: require('../../../../../assets/nox-reels/symbols/ring.png'),
  CROWN: require('../../../../../assets/nox-reels/symbols/crown.png'),
  WATCH: require('../../../../../assets/nox-reels/symbols/watch.png'),
  DIAMOND: require('../../../../../assets/nox-reels/symbols/diamond.png'),
  ROYAL_CROWN: require('../../../../../assets/nox-reels/symbols/royal_crown.png'),
  WILD: require('../../../../../assets/nox-reels/symbols/wild.png'),
  SCATTER: require('../../../../../assets/nox-reels/symbols/scatter.png'),
};

export const BackgroundImages = {
  nightSky: require('../../../../../assets/nox-reels/background/night_sky.png'),
} as const;

export const UiImages = {
  spinButton: require('../../../../../assets/nox-reels/ui/spin_button.png'),
  cover: require('../../../../../assets/nox-reels/ui/cover.png'),
} as const;

export const VisualAssets = {
  symbols: SymbolImages,
  background: BackgroundImages,
  ui: UiImages,
} as const;

export const ALL_SYMBOL_SOURCES = Object.values(SymbolImages);
