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
export const GAME_SUBTITLE = 'The Storm Keeper' as const;
export const GAME_VERSION = 'realm_of_storms-v1.2.0' as const;

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
  1: 120,
  2: 160,
  3: 200,
  4: 230,
  5: 260,
} as const;

export const LANDING_BOUNCE_MS = 70;
export const DESTROY_MS = 240;
export const MATCH_GLOW_MS = 220;
export const MULTIPLIER_REVEAL_MS = 360;
export const MULTIPLIER_COLLECT_MS = 280;
export const ANTICIPATION_MS = 1600;
export const WIN_COUNT_MS = {
  normal: 400,
  medium: 800,
  big: 2000,
  epic: 3000,
} as const;

/** Count-up bittikten sonra kilitlenen tutarın kutlama payı */
export const WIN_HOLD_MS = 1000;

export function winCountDurationMs(tier: WinTier): number {
  if (tier === 'DIVINE' || tier === 'COSMIC') return WIN_COUNT_MS.epic;
  if (tier === 'THUNDER') return WIN_COUNT_MS.big;
  if (tier === 'STORM') return WIN_COUNT_MS.medium;
  return WIN_COUNT_MS.normal;
}

export function winCelebrationMs(tier: WinTier): number {
  return winCountDurationMs(tier) + WIN_HOLD_MS;
}

export const CHANNEL_VOLUMES = {
  MUSIC: 0.22,
  AMBIENCE: 0.14,
  SFX: 0.42,
  UI: 0.3,
  WIN: 0.64,
  CHARACTER: 0.32,
} as const;

export const VOICE_DUCK_FACTOR = 0.55;
export const MUSIC_DUCK_VOLUME = 0.12;

export const FAST_SPEED_FACTOR = 0.55;

export const AUTOPLAY_OPTIONS = [10, 25, 50, 100, 250, 500] as const;

/** Mevcut bahisle bakiyenin karşıladığı en fazla oto tur. */
export function maxAffordableAutoplayTours(
  balance: number,
  bet: number,
): number {
  if (!(bet > 0) || !(balance > 0)) return 0;
  return Math.floor(balance / bet);
}

/** İstenen tur sayısını bakiyenin yettiği kadar kısar. */
export function clampAutoplayTours(
  requested: number,
  maxTours: number,
): number {
  if (!(requested > 0) || !(maxTours > 0)) return 0;
  return Math.min(Math.floor(requested), Math.floor(maxTours));
}

/**
 * STORM_V1 — arşivlenmiş profil (immutable referans).
 * Yüksek low-symbol yoğunluğu → ~%39 hit-rate.
 */
export const MATH_STORM_V1: KaskadMathConfig = {
  mathVersion: 'storm-v1',
  paytableVersion: 'storm-pay-v1',
  configVersion: 'storm-cfg-v1',
  columns: GRID_COLUMNS,
  rows: GRID_ROWS,
  minMatchCount: MIN_MATCH_COUNT,
  paytable: {
    blueCrystal: { 8: 0.21, 10: 0.68, 12: 1.7 },
    greenCrystal: { 8: 0.21, 10: 0.68, 12: 1.7 },
    purpleCrystal: { 8: 0.36, 10: 0.75, 12: 2.0 },
    redCrystal: { 8: 0.36, 10: 0.75, 12: 2.0 },
    goldCrystal: { 8: 0.46, 10: 1.0, 12: 2.5 },
    stormRing: { 8: 0.85, 10: 2.1, 12: 5.0 },
    celestialCup: { 8: 1.3, 10: 3.4, 12: 8.5 },
    timeCore: { 8: 2.1, 10: 5.0, 12: 12.5 },
    energyCrown: { 8: 3.5, 10: 8.5, 12: 21 },
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
  betPresets: [20, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
  minBet: 20,
  maxBet: 50000,
  autoplayEnabled: true,
  turboEnabled: true,
};

/**
 * STORM_V2 — çeşitlilik artırıldı; V1'e göre hit-rate düşürüldü.
 * Kalibrasyon: 100k sim hedefi hit ~%28–34, RTP ~%92–96.
 * Production ACTIVE yapılmadan önce simülasyon zorunlu.
 */
export const MATH_STORM_V2: KaskadMathConfig = {
  mathVersion: 'storm-v2',
  paytableVersion: 'storm-pay-v2',
  configVersion: 'storm-cfg-v2',
  columns: GRID_COLUMNS,
  rows: GRID_ROWS,
  minMatchCount: MIN_MATCH_COUNT,
  paytable: {
    blueCrystal: { 8: 0.41, 10: 1.24, 12: 3.05 },
    greenCrystal: { 8: 0.41, 10: 1.24, 12: 3.05 },
    purpleCrystal: { 8: 0.61, 10: 1.5, 12: 3.75 },
    redCrystal: { 8: 0.61, 10: 1.5, 12: 3.75 },
    goldCrystal: { 8: 0.82, 10: 1.95, 12: 4.7 },
    stormRing: { 8: 1.53, 10: 3.9, 12: 9.2 },
    celestialCup: { 8: 2.22, 10: 5.9, 12: 14.6 },
    timeCore: { 8: 3.65, 10: 8.75, 12: 22.4 },
    energyCrown: { 8: 6.1, 10: 15.3, 12: 38.8 },
  },
  // V1 ile aşırı-eşit V2 denemesi arasında — low baskısı azaltıldı
  symbolWeights: {
    blueCrystal: 17,
    greenCrystal: 17,
    purpleCrystal: 15,
    redCrystal: 15,
    goldCrystal: 13,
    stormRing: 9,
    celestialCup: 7,
    timeCore: 5.5,
    energyCrown: 4,
  },
  multiplierWeights: [
    { value: 2, weight: 40 },
    { value: 3, weight: 24 },
    { value: 4, weight: 12 },
    { value: 5, weight: 10 },
    { value: 6, weight: 5 },
    { value: 8, weight: 3.8 },
    { value: 10, weight: 2.3 },
    { value: 15, weight: 1.15 },
    { value: 25, weight: 0.65 },
    { value: 50, weight: 0.35 },
    { value: 100, weight: 0.18 },
    { value: 250, weight: 0.05 },
    { value: 500, weight: 0.02 },
  ],
  multiplierSpawnChance: 0.028,
  scatterSpawnChance: 0.0115,
  scatterBonus: { 4: 15, 5: 20, 6: 25 },
  bonus: {
    persistentMultiplier: true,
    multiplierSpawnChance: 0.05,
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
  betPresets: [20, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
  minBet: 20,
  maxBet: 50000,
  autoplayEnabled: true,
  turboEnabled: true,
};

/**
 * Client varsayılanı = V2 (sim sonrası ACTIVE adayı).
 * Server'da aktif kaskad_math_versions kaydı her zaman otoritedir.
 */
export const DEFAULT_MATH_CONFIG: KaskadMathConfig = MATH_STORM_V2;

export const MATH_PROFILES = {
  'storm-v1': MATH_STORM_V1,
  'storm-v2': MATH_STORM_V2,
} as const;

export const WIN_TIER_LABELS: Record<WinTier, string> = {
  NONE: '',
  STORM: 'STORM WIN',
  THUNDER: 'THUNDER WIN',
  COSMIC: 'COSMIC STORM',
  DIVINE: 'DIVINE STORM',
};
