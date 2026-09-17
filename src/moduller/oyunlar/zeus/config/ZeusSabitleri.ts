/**
 * ZEUS — sabitler ve varsayılan matematik.
 * Magic number yok; 4 / 15 dahil tüm eşikler config'ten gelir.
 */

import type { ZeusMathConfig, ZeusSymbolType, ZeusWinTier } from '../tipler/ZeusTipleri';

export const GAME_CODE = 'zeus' as const;
export const GAME_DISPLAY_NAME = 'ZEUS' as const;
export const GAME_SUBTITLE = 'Olympus Cascade' as const;
export const GAME_VERSION = 'zeus-v1.0.0' as const;

export const GRID_COLUMNS = 6;
export const GRID_ROWS = 5;
export const GRID_CELL_COUNT = GRID_COLUMNS * GRID_ROWS;

export const MIN_MATCH_COUNT = 8;
export const PAY_BAND_KEYS = [8, 10, 12] as const;

export const FREE_SPIN_TRIGGER_COUNT = 4;
export const FREE_SPIN_REWARD = 15;

export const LOW_SYMBOLS: readonly ZeusSymbolType[] = [
  'blueDiamond',
  'greenEmerald',
  'purpleGem',
  'redRuby',
] as const;

export const HIGH_SYMBOLS: readonly ZeusSymbolType[] = [
  'goldCrown',
  'goldRing',
  'goldGoblet',
  'lyre',
  'pegasus',
] as const;

export const SPECIAL_SYMBOLS: readonly ZeusSymbolType[] = [
  'zeusScatter',
  'multiplierOrb',
] as const;

export const ALL_PAY_SYMBOLS: readonly ZeusSymbolType[] = [
  ...LOW_SYMBOLS,
  ...HIGH_SYMBOLS,
] as const;

export const SYMBOL_LABELS: Record<ZeusSymbolType, string> = {
  blueDiamond: 'Mavi Elmas',
  greenEmerald: 'Zümrüt',
  purpleGem: 'Mor Mücevher',
  redRuby: 'Yakut',
  goldCrown: 'Altın Taç',
  goldRing: 'Altın Yüzük',
  goldGoblet: 'Kadeh',
  lyre: 'Lir',
  pegasus: 'Pegasus',
  zeusScatter: 'Zeus',
  multiplierOrb: 'Çarpan',
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
export const MULTIPLIER_COLLECT_MS = 420;
export const ANTICIPATION_MS = 1600;
export const SCATTER_SILENCE_MS = 100;
export const WIN_HOLD_MS = 1000;

export const WIN_COUNT_MS = {
  normal: 400,
  nice: 700,
  big: 1800,
  mega: 2800,
  sensational: 3600,
} as const;

export function winCountDurationMs(tier: ZeusWinTier): number {
  if (tier === 'SENSATIONAL') return WIN_COUNT_MS.sensational;
  if (tier === 'MEGA') return WIN_COUNT_MS.mega;
  if (tier === 'BIG') return WIN_COUNT_MS.big;
  if (tier === 'NICE') return WIN_COUNT_MS.nice;
  return WIN_COUNT_MS.normal;
}

export function winCelebrationMs(tier: ZeusWinTier): number {
  return winCountDurationMs(tier) + WIN_HOLD_MS;
}

export const CHANNEL_VOLUMES = {
  MASTER: 1,
  MUSIC: 0.22,
  AMBIENCE: 0.12,
  SFX: 0.44,
  VOICE: 0.55,
} as const;

export const VOICE_DUCK_FACTOR = 0.55;
export const MUSIC_DUCK_VOLUME = 0.12;
export const FAST_SPEED_FACTOR = 0.55;
export const AUTOPLAY_OPTIONS = [10, 25, 50, 100, 250, 500] as const;

export function maxAffordableAutoplayTours(balance: number, bet: number): number {
  if (!(bet > 0) || !(balance > 0)) return 0;
  return Math.floor(balance / bet);
}

export function clampAutoplayTours(requested: number, maxTours: number): number {
  if (!(requested > 0) || !(maxTours > 0)) return 0;
  return Math.min(Math.floor(requested), Math.floor(maxTours));
}

/**
 * Olympus-style tumble math (pay-anywhere 8+, sequence-end multiplier sum).
 * Kalibre hedef: hit ~%28–34, RTP ~%94–96, max 5000x.
 */
export const MATH_OLYMPUS_V1: ZeusMathConfig = {
  mathVersion: 'olympus-v1',
  paytableVersion: 'zeus-pay-v1',
  configVersion: 'zeus-cfg-v1',
  columns: GRID_COLUMNS,
  rows: GRID_ROWS,
  minMatchCount: MIN_MATCH_COUNT,
  paytable: {
    blueDiamond: { 8: 0.25, 10: 0.8, 12: 2.0 },
    greenEmerald: { 8: 0.25, 10: 0.8, 12: 2.0 },
    purpleGem: { 8: 0.4, 10: 1.0, 12: 2.5 },
    redRuby: { 8: 0.4, 10: 1.0, 12: 2.5 },
    goldCrown: { 8: 0.8, 10: 2.0, 12: 5.0 },
    goldRing: { 8: 1.2, 10: 3.0, 12: 8.0 },
    goldGoblet: { 8: 1.6, 10: 4.0, 12: 10.0 },
    lyre: { 8: 2.4, 10: 6.0, 12: 15.0 },
    pegasus: { 8: 4.0, 10: 10.0, 12: 25.0 },
  },
  symbolWeights: {
    blueDiamond: 18,
    greenEmerald: 18,
    purpleGem: 15,
    redRuby: 15,
    goldCrown: 9,
    goldRing: 7.5,
    goldGoblet: 6.5,
    lyre: 5,
    pegasus: 3.5,
  },
  multiplierWeights: [
    { value: 2, weight: 40 },
    { value: 3, weight: 24 },
    { value: 4, weight: 12 },
    { value: 5, weight: 10 },
    { value: 10, weight: 6 },
    { value: 15, weight: 3.2 },
    { value: 25, weight: 1.8 },
    { value: 50, weight: 0.7 },
    { value: 100, weight: 0.22 },
    { value: 250, weight: 0.06 },
    { value: 500, weight: 0.02 },
  ],
  multiplierSpawnChance: 0.028,
  scatterSpawnChance: 0.0118,
  freeSpinTriggerCount: FREE_SPIN_TRIGGER_COUNT,
  freeSpinReward: FREE_SPIN_REWARD,
  retriggerMinCount: FREE_SPIN_TRIGGER_COUNT,
  retriggerReward: FREE_SPIN_REWARD,
  bonus: {
    persistentMultiplier: true,
    multiplierSpawnChance: 0.05,
  },
  maxCascades: 32,
  maxEvents: 256,
  maxPayoutMult: 5000,
  winTiers: {
    nice: 5,
    big: 15,
    mega: 40,
    sensational: 80,
  },
  betPresets: [20, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
  minBet: 20,
  maxBet: 50000,
  autoplayEnabled: true,
  turboEnabled: true,
};

export const DEFAULT_MATH_CONFIG: ZeusMathConfig = MATH_OLYMPUS_V1;

export const MATH_PROFILES = {
  'olympus-v1': MATH_OLYMPUS_V1,
} as const;

export const WIN_TIER_LABELS: Record<ZeusWinTier, string> = {
  NONE: '',
  NORMAL: 'KAZANÇ',
  NICE: 'GÜZEL KAZANÇ',
  BIG: 'BÜYÜK KAZANÇ',
  MEGA: 'MEGA KAZANÇ',
  SENSATIONAL: 'EFSANEVİ KAZANÇ',
};

export const ZEUS_PALETTE = {
  gold: '#E8C547',
  goldBright: '#F6E27A',
  deepPurple: '#2A1258',
  electricBlue: '#4DA8FF',
  navy: '#070B18',
  marble: '#E8E0D4',
  black: '#05070F',
} as const;
