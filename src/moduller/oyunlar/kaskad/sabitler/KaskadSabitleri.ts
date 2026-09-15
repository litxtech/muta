/**
 * Kozmik Kaskad — sabitler ve varsayılan matematik config.
 * Magic number yok; tüm oranlar buradan / admin config'ten gelir.
 */

import type {
  KaskadMathConfig,
  KaskadSymbolType,
  WinTier,
} from '../tipler/KaskadTipleri';
import { RenkTokenlari } from '../../../../tasarim-sistemi/RenkTokenlari';

export const GAME_CODE = 'kozmik_kaskad' as const;
export const GAME_DISPLAY_NAME = 'Kozmik Kaskad' as const;
export const GAME_VERSION = 'kozmik_kaskad-v1.0.0' as const;

export const GRID_COLUMNS = 6;
export const GRID_ROWS = 5;
export const GRID_CELL_COUNT = GRID_COLUMNS * GRID_ROWS;

export const MIN_MATCH_COUNT = 8;

export const PAY_BAND_KEYS = [8, 10, 12] as const;

export const LOW_SYMBOLS: readonly KaskadSymbolType[] = [
  'crystalBlue',
  'crystalViolet',
  'crystalMint',
  'crystalAmber',
] as const;

export const HIGH_SYMBOLS: readonly KaskadSymbolType[] = [
  'starCore',
  'cosmicEye',
  'galaxyOrb',
  'energyCrown',
] as const;

export const SPECIAL_SYMBOLS: readonly KaskadSymbolType[] = [
  'portalScatter',
  'multiplierOrb',
] as const;

export const ALL_PAY_SYMBOLS: readonly KaskadSymbolType[] = [
  ...LOW_SYMBOLS,
  ...HIGH_SYMBOLS,
] as const;

export const SYMBOL_LABELS: Record<KaskadSymbolType, string> = {
  crystalBlue: 'Mavi Kristal',
  crystalViolet: 'Mor Kristal',
  crystalMint: 'Yeşil Kristal',
  crystalAmber: 'Turuncu Kristal',
  starCore: 'Yıldız Çekirdeği',
  cosmicEye: 'Kozmik Göz',
  galaxyOrb: 'Galaksi Küresi',
  energyCrown: 'Enerji Tacı',
  portalScatter: 'Portal',
  multiplierOrb: 'Çarpan Küresi',
};

/** Renk körlüğü için şekil kodları — yalnız renge bağlı değil */
export const SYMBOL_SHAPES: Record<KaskadSymbolType, string> = {
  crystalBlue: '◇',
  crystalViolet: '◈',
  crystalMint: '⬡',
  crystalAmber: '◆',
  starCore: '✶',
  cosmicEye: '◎',
  galaxyOrb: '✺',
  energyCrown: '♛',
  portalScatter: '◉',
  multiplierOrb: '✦',
};

export const SYMBOL_COLORS: Record<KaskadSymbolType, string> = {
  crystalBlue: '#4DA3FF',
  crystalViolet: RenkTokenlari.violet,
  crystalMint: RenkTokenlari.mint,
  crystalAmber: '#F08A3B',
  starCore: RenkTokenlari.accent,
  cosmicEye: RenkTokenlari.magenta,
  galaxyOrb: RenkTokenlari.primarySoft,
  energyCrown: '#FFD66B',
  portalScatter: '#A78BFA',
  multiplierOrb: '#FF6B9D',
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
export const MATCH_GLOW_MS = 220;
export const MULTIPLIER_FLIGHT_MS = 520;
export const WIN_COUNT_MS = {
  normal: 400,
  big: 1500,
  epic: 3000,
} as const;

export const SFX_VOLUME = 0.42;
export const MUSIC_VOLUME = 0.22;
export const MUSIC_DUCK_VOLUME = 0.12;

export const FAST_SPEED_FACTOR = 0.55;

export const DEFAULT_MATH_CONFIG: KaskadMathConfig = {
  mathVersion: 'math-v1',
  paytableVersion: 'pay-v1',
  configVersion: 'cfg-v1',
  columns: GRID_COLUMNS,
  rows: GRID_ROWS,
  minMatchCount: MIN_MATCH_COUNT,
  paytable: {
    crystalBlue: { 8: 1.0, 10: 2.0, 12: 4.5 },
    crystalViolet: { 8: 1.0, 10: 2.0, 12: 4.5 },
    crystalMint: { 8: 1.2, 10: 2.5, 12: 5.5 },
    crystalAmber: { 8: 1.2, 10: 2.5, 12: 5.5 },
    starCore: { 8: 3.0, 10: 6.0, 12: 12 },
    cosmicEye: { 8: 4.0, 10: 8.0, 12: 16 },
    galaxyOrb: { 8: 5.0, 10: 10, 12: 22 },
    energyCrown: { 8: 7.0, 10: 14, 12: 30 },
  },
  symbolWeights: {
    crystalBlue: 18,
    crystalViolet: 18,
    crystalMint: 17,
    crystalAmber: 17,
    starCore: 10,
    cosmicEye: 8,
    galaxyOrb: 7,
    energyCrown: 5,
  },
  multiplierWeights: [
    { value: 2, weight: 45 },
    { value: 3, weight: 28 },
    { value: 5, weight: 14 },
    { value: 10, weight: 7 },
    { value: 25, weight: 3.5 },
    { value: 50, weight: 1.5 },
    { value: 100, weight: 1 },
  ],
  multiplierSpawnChance: 0.045,
  scatterSpawnChance: 0.04,
  scatterBonus: { 4: 10, 5: 12, 6: 15 },
  maxCascades: 32,
  maxPayoutMult: 5000,
  winTiers: {
    energy: 10,
    cosmic: 25,
    galactic: 50,
    supernova: 100,
  },
  betPresets: [10, 20, 50, 100, 250, 500],
  minBet: 10,
  maxBet: 5000,
};

export const WIN_TIER_LABELS: Record<WinTier, string> = {
  NONE: '',
  ENERGY: 'ENERGY WIN',
  COSMIC: 'COSMIC WIN',
  GALACTIC: 'GALACTIC WIN',
  SUPERNOVA: 'SUPERNOVA WIN',
};

export const AUTOPLAY_OPTIONS = [5, 10, 25, 50] as const;
