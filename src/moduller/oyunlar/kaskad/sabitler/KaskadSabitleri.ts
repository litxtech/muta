/**
 * TAMUSO: REALM OF STORMS — sabitler ve varsayılan matematik config.
 * Magic number yok; tüm oranlar buradan / aktif math profilinden gelir.
 * Production sonuç HER ZAMAN server'daki aktif math versiyonuyla üretilir.
 */

import type {
  KaskadMathConfig,
  KaskadSymbolType,
  WinTier,
} from '../tipler/KaskadTipleri';
import { RenkTokenlari } from '../../../../tasarim-sistemi/RenkTokenlari';

export const GAME_CODE = 'kozmik_kaskad' as const;
export const GAME_DISPLAY_NAME = 'Realm of Storms' as const;
export const GAME_SUBTITLE = 'Fırtına Muhafızı' as const;
export const GAME_VERSION = 'realm_of_storms-v1.0.0' as const;

export const GRID_COLUMNS = 6;
export const GRID_ROWS = 5;
export const GRID_CELL_COUNT = GRID_COLUMNS * GRID_ROWS;

export const MIN_MATCH_COUNT = 8;

export const PAY_BAND_KEYS = [8, 10, 12] as const;

export const LOW_SYMBOLS: readonly KaskadSymbolType[] = [
  'blueCrystal',
  'greenCrystal',
  'purpleCrystal',
  'redCrystal',
  'goldCrystal',
] as const;

export const HIGH_SYMBOLS: readonly KaskadSymbolType[] = [
  'stormRing',
  'celestialCup',
  'timeCore',
  'energyCrown',
] as const;

export const SPECIAL_SYMBOLS: readonly KaskadSymbolType[] = [
  'portalScatter',
  'stormMultiplier',
] as const;

export const ALL_PAY_SYMBOLS: readonly KaskadSymbolType[] = [
  ...LOW_SYMBOLS,
  ...HIGH_SYMBOLS,
] as const;

export const SYMBOL_LABELS: Record<KaskadSymbolType, string> = {
  blueCrystal: 'Mavi Kristal',
  greenCrystal: 'Yeşil Kristal',
  purpleCrystal: 'Mor Kristal',
  redCrystal: 'Kızıl Kristal',
  goldCrystal: 'Altın Kristal',
  stormRing: 'Fırtına Halkası',
  celestialCup: 'Göksel Kupa',
  timeCore: 'Zaman Çekirdeği',
  energyCrown: 'Enerji Tacı',
  portalScatter: 'Portal',
  stormMultiplier: 'Fırtına Çarpanı',
};

/** Renk körlüğü için şekil kodları — semboller yalnız renge bağlı değil */
export const SYMBOL_SHAPES: Record<KaskadSymbolType, string> = {
  blueCrystal: '◆',
  greenCrystal: '⬡',
  purpleCrystal: '◈',
  redCrystal: '▲',
  goldCrystal: '⬟',
  stormRing: '◎',
  celestialCup: '♆',
  timeCore: '✪',
  energyCrown: '♛',
  portalScatter: '◉',
  stormMultiplier: '⚡',
};

export const SYMBOL_COLORS: Record<KaskadSymbolType, string> = {
  blueCrystal: '#4DA3FF',
  greenCrystal: RenkTokenlari.mint,
  purpleCrystal: RenkTokenlari.violet,
  redCrystal: '#F05A5A',
  goldCrystal: RenkTokenlari.accent,
  stormRing: '#6FE3FF',
  celestialCup: RenkTokenlari.magenta,
  timeCore: '#B7F06B',
  energyCrown: '#FFD66B',
  portalScatter: '#A78BFA',
  stormMultiplier: '#FF6B9D',
};

export const DROP_MS_PER_CELL = {
  1: 180,
  2: 220,
  3: 260,
  4: 300,
  5: 340,
} as const;

export const LANDING_BOUNCE_MS = 120;
export const DESTROY_MS = 280;
export const MATCH_GLOW_MS = 340;
export const MULTIPLIER_REVEAL_MS = 620;
export const MULTIPLIER_COLLECT_MS = 480;
export const ANTICIPATION_MS = 1400;
export const WIN_COUNT_MS = {
  normal: 450,
  medium: 900,
  big: 2200,
  epic: 3400,
} as const;

export const CHANNEL_VOLUMES = {
  MUSIC: 0.22,
  AMBIENCE: 0.14,
  SFX: 0.42,
  UI: 0.3,
  WIN: 0.5,
  CHARACTER: 0.32,
} as const;

export const VOICE_DUCK_FACTOR = 0.55;
export const MUSIC_DUCK_VOLUME = 0.12;

export const FAST_SPEED_FACTOR = 0.55;

export const AUTOPLAY_OPTIONS = [5, 10, 25, 50] as const;

/**
 * STORM_V1 — simülasyonla kalibre edilen varsayılan profil.
 * Kaynak: scripts/kaskad-simulator.ts raporu (hedef bant RTP %92–96).
 * Production'da server'daki aktif kaskad_math_versions kaydı geçerlidir.
 */
export const DEFAULT_MATH_CONFIG: KaskadMathConfig = {
  mathVersion: 'storm-v1',
  paytableVersion: 'storm-pay-v1',
  configVersion: 'storm-cfg-v1',
  columns: GRID_COLUMNS,
  rows: GRID_ROWS,
  minMatchCount: MIN_MATCH_COUNT,
  paytable: {
    blueCrystal: { 8: 0.25, 10: 0.75, 12: 2.0 },
    greenCrystal: { 8: 0.25, 10: 0.75, 12: 2.0 },
    purpleCrystal: { 8: 0.4, 10: 0.9, 12: 2.4 },
    redCrystal: { 8: 0.4, 10: 0.9, 12: 2.4 },
    goldCrystal: { 8: 0.5, 10: 1.2, 12: 3.0 },
    stormRing: { 8: 1.0, 10: 2.5, 12: 6.0 },
    celestialCup: { 8: 1.5, 10: 4.0, 12: 10 },
    timeCore: { 8: 2.5, 10: 6.0, 12: 15 },
    energyCrown: { 8: 4.0, 10: 10, 12: 25 },
  },
  symbolWeights: {
    blueCrystal: 20,
    greenCrystal: 20,
    purpleCrystal: 17,
    redCrystal: 17,
    goldCrystal: 14,
    stormRing: 8,
    celestialCup: 6.5,
    timeCore: 5,
    energyCrown: 3.5,
  },
  multiplierWeights: [
    { value: 2, weight: 40 },
    { value: 3, weight: 24 },
    { value: 4, weight: 12 },
    { value: 5, weight: 10 },
    { value: 6, weight: 5 },
    { value: 8, weight: 4 },
    { value: 10, weight: 2.4 },
    { value: 15, weight: 1.2 },
    { value: 25, weight: 0.7 },
    { value: 50, weight: 0.4 },
    { value: 100, weight: 0.2 },
    { value: 250, weight: 0.06 },
    { value: 500, weight: 0.02 },
  ],
  multiplierSpawnChance: 0.03,
  scatterSpawnChance: 0.012,
  scatterBonus: { 4: 15, 5: 20, 6: 25 },
  bonus: {
    persistentMultiplier: true,
    multiplierSpawnChance: 0.055,
    retrigger: { minScatters: 3, extraSpins: 5 },
  },
  maxCascades: 32,
  maxEvents: 256,
  maxPayoutMult: 5000,
  winTiers: {
    storm: 10,
    thunder: 25,
    cosmic: 50,
    divine: 100,
  },
  betPresets: [10, 20, 50, 100, 250, 500],
  minBet: 10,
  maxBet: 5000,
  autoplayEnabled: true,
  turboEnabled: true,
};

export const WIN_TIER_LABELS: Record<WinTier, string> = {
  NONE: '',
  STORM: 'STORM WIN',
  THUNDER: 'THUNDER WIN',
  COSMIC: 'COSMIC STORM',
  DIVINE: 'DIVINE STORM',
};
