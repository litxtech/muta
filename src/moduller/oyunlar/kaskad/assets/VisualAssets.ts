/**
 * Realm of Storms — görsel asset registry.
 * Prosedürel fallback YOK; production path Image kullanır.
 */

import type { ImageSourcePropType } from 'react-native';
import type { KaskadSymbolType } from '../tipler/KaskadTipleri';

export const SymbolImages: Record<KaskadSymbolType, ImageSourcePropType> = {
  blueCrystal: require('../../../../../assets/realm-of-storms/symbols/blue_storm_gem.png'),
  greenCrystal: require('../../../../../assets/realm-of-storms/symbols/green_storm_gem.png'),
  purpleCrystal: require('../../../../../assets/realm-of-storms/symbols/purple_storm_gem.png'),
  redCrystal: require('../../../../../assets/realm-of-storms/symbols/red_storm_gem.png'),
  goldCrystal: require('../../../../../assets/realm-of-storms/symbols/amber_storm_gem.png'),
  stormRing: require('../../../../../assets/realm-of-storms/symbols/tempest_ring.png'),
  celestialCup: require('../../../../../assets/realm-of-storms/symbols/celestial_chalice.png'),
  timeCore: require('../../../../../assets/realm-of-storms/symbols/time_relic.png'),
  energyCrown: require('../../../../../assets/realm-of-storms/symbols/storm_crown.png'),
  portalScatter: require('../../../../../assets/realm-of-storms/symbols/storm_portal_scatter.png'),
  stormMultiplier: require('../../../../../assets/realm-of-storms/symbols/storm_multiplier_orb.png'),
};

export const CharacterImages = {
  stormKeeper: require('../../../../../assets/realm-of-storms/character/storm_keeper.png'),
} as const;

export const BackgroundImages = {
  stormSky: require('../../../../../assets/realm-of-storms/background/storm_sky_bg.png'),
} as const;

export const UiImages = {
  spinButton: require('../../../../../assets/realm-of-storms/ui/storm_spin_button.png'),
} as const;

export const VisualAssets = {
  symbols: SymbolImages,
  character: CharacterImages,
  background: BackgroundImages,
  ui: UiImages,
} as const;
