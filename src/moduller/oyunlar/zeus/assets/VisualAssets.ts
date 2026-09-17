/**
 * ZEUS — görsel asset registry.
 * Production path Image kullanır; prosedürel fallback yok.
 */

import type { ImageSourcePropType } from 'react-native';
import type { ZeusSymbolType } from '../tipler/ZeusTipleri';

export const SymbolImages: Record<ZeusSymbolType, ImageSourcePropType> = {
  blueDiamond: require('../../../../../assets/zeus/symbols/blue_diamond.png'),
  greenEmerald: require('../../../../../assets/zeus/symbols/green_emerald.png'),
  purpleGem: require('../../../../../assets/zeus/symbols/purple_gem.png'),
  redRuby: require('../../../../../assets/zeus/symbols/red_ruby.png'),
  goldCrown: require('../../../../../assets/zeus/symbols/gold_crown.png'),
  goldRing: require('../../../../../assets/zeus/symbols/gold_ring.png'),
  goldGoblet: require('../../../../../assets/zeus/symbols/gold_goblet.png'),
  lyre: require('../../../../../assets/zeus/symbols/lyre.png'),
  pegasus: require('../../../../../assets/zeus/symbols/pegasus.png'),
  zeusScatter: require('../../../../../assets/zeus/symbols/zeus_scatter.png'),
  multiplierOrb: require('../../../../../assets/zeus/symbols/multiplier_orb.png'),
};

export const CharacterImages = {
  zeusIdle: require('../../../../../assets/zeus/character/zeus_idle.png'),
} as const;

export const BackgroundImages = {
  olympusSky: require('../../../../../assets/zeus/background/olympus_sky.png'),
} as const;

export const UiImages = {
  spinButton: require('../../../../../assets/zeus/ui/spin_button.png'),
  cover: require('../../../../../assets/zeus/covers/zeus_cover.png'),
} as const;

export const VisualAssets = {
  symbols: SymbolImages,
  character: CharacterImages,
  background: BackgroundImages,
  ui: UiImages,
} as const;
