/**
 * NOX REELS — sabitler + varsayılan matematik + animasyon config.
 */

import type {
  SlotAnimationConfig,
  SlotMathConfig,
  SlotSymbolDef,
  SlotSymbolId,
  SlotWinTier,
} from '../tipler/SlotTipleri';

export const GAME_CODE = 'nox_reels' as const;
export const GAME_DISPLAY_NAME = 'NOX REELS' as const;
export const GAME_SUBTITLE = '5×3 Night Slot' as const;
export const GAME_VERSION = 'nox-v1.0.0' as const;

export const REEL_COUNT = 5;
export const ROW_COUNT = 3;
export const VISIBLE_SYMBOLS = REEL_COUNT * ROW_COUNT;

export const SYMBOL_DEFS: Record<SlotSymbolId, SlotSymbolDef> = {
  J: {
    id: 'J',
    name: 'Jack',
    rarity: 'low',
    animationType: 'idle',
    soundType: 'low',
    tint: '#7EB8FF',
  },
  Q: {
    id: 'Q',
    name: 'Queen',
    rarity: 'low',
    animationType: 'idle',
    soundType: 'low',
    tint: '#C4A0FF',
  },
  K: {
    id: 'K',
    name: 'King',
    rarity: 'low',
    animationType: 'idle',
    soundType: 'low',
    tint: '#FF9B7A',
  },
  A: {
    id: 'A',
    name: 'Ace',
    rarity: 'low',
    animationType: 'pulse',
    soundType: 'low',
    tint: '#FFE08A',
  },
  GEM: {
    id: 'GEM',
    name: 'Amethyst',
    rarity: 'mid',
    animationType: 'glow',
    soundType: 'mid',
    tint: '#B794F6',
  },
  RING: {
    id: 'RING',
    name: 'Noir Ring',
    rarity: 'mid',
    animationType: 'glow',
    soundType: 'mid',
    tint: '#E8C547',
  },
  CROWN: {
    id: 'CROWN',
    name: 'Velvet Crown',
    rarity: 'mid',
    animationType: 'sparkle',
    soundType: 'mid',
    tint: '#F0B429',
  },
  WATCH: {
    id: 'WATCH',
    name: 'Chrono',
    rarity: 'mid',
    animationType: 'glow',
    soundType: 'mid',
    tint: '#6FE3FF',
  },
  DIAMOND: {
    id: 'DIAMOND',
    name: 'Night Diamond',
    rarity: 'high',
    animationType: 'sparkle',
    soundType: 'high',
    tint: '#A8E6FF',
  },
  ROYAL_CROWN: {
    id: 'ROYAL_CROWN',
    name: 'Royal Crest',
    rarity: 'high',
    animationType: 'sparkle',
    soundType: 'high',
    tint: '#FFD86B',
  },
  WILD: {
    id: 'WILD',
    name: 'Wild',
    rarity: 'special',
    animationType: 'wild',
    soundType: 'wild',
    tint: '#FFD700',
  },
  SCATTER: {
    id: 'SCATTER',
    name: 'Nox Orb',
    rarity: 'special',
    animationType: 'scatter',
    soundType: 'scatter',
    tint: '#E879F9',
  },
};

/** 20 sabit payline — satır indeksleri (0 üst, 1 orta, 2 alt) */
export const DEFAULT_PAYLINES: number[][] = [
  [1, 1, 1, 1, 1], // orta
  [0, 0, 0, 0, 0], // üst
  [2, 2, 2, 2, 2], // alt
  [0, 1, 2, 1, 0], // V
  [2, 1, 0, 1, 2], // ^
  [0, 0, 1, 0, 0],
  [2, 2, 1, 2, 2],
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
  [0, 1, 1, 1, 0],
  [2, 1, 1, 1, 2],
  [1, 0, 1, 0, 1],
  [1, 2, 1, 2, 1],
  [0, 1, 0, 1, 0],
  [2, 1, 2, 1, 2],
  [0, 2, 0, 2, 0],
  [2, 0, 2, 0, 2],
  [0, 0, 2, 0, 0],
  [2, 2, 0, 2, 2],
  [1, 1, 0, 1, 1],
];

const LOW: SlotSymbolId[] = ['J', 'Q', 'K', 'A'];
const MID: SlotSymbolId[] = ['GEM', 'RING', 'CROWN', 'WATCH'];
const HIGH: SlotSymbolId[] = ['DIAMOND', 'ROYAL_CROWN'];

function buildStrip(seedBias: number): SlotSymbolId[] {
  const strip: SlotSymbolId[] = [];
  // ~48 uzunluk — klasik makara hissi
  for (let i = 0; i < 48; i++) {
    const r = (i * 17 + seedBias * 13) % 100;
    if (r < 3) strip.push('WILD');
    else if (r < 6) strip.push('SCATTER');
    else if (r < 14) strip.push(HIGH[r % HIGH.length]!);
    else if (r < 42) strip.push(MID[r % MID.length]!);
    else strip.push(LOW[r % LOW.length]!);
  }
  return strip;
}

export const DEFAULT_MATH_CONFIG: SlotMathConfig = {
  mathVersion: 'nox-math-v1',
  paytableVersion: 'nox-pay-v1',
  configVersion: 'nox-cfg-v1',
  reels: REEL_COUNT,
  rows: ROW_COUNT,
  reelStrips: [
    buildStrip(1),
    buildStrip(2),
    buildStrip(3),
    buildStrip(4),
    buildStrip(5),
  ],
  paylines: DEFAULT_PAYLINES,
  paytable: {
    // TOPLAM bahis çarpanı — hedef RTP ~94%
    J: { 3: 0.58, 4: 1.7, 5: 5.8 },
    Q: { 3: 0.58, 4: 1.7, 5: 5.8 },
    K: { 3: 0.72, 4: 2.1, 5: 7.2 },
    A: { 3: 0.88, 4: 2.6, 5: 8.8 },
    GEM: { 3: 1.15, 4: 3.5, 5: 11.5 },
    RING: { 3: 1.45, 4: 4.4, 5: 14.5 },
    CROWN: { 3: 1.75, 4: 5.8, 5: 17.5 },
    WATCH: { 3: 2.1, 4: 7.2, 5: 21 },
    DIAMOND: { 3: 3.5, 4: 11.5, 5: 35 },
    ROYAL_CROWN: { 3: 5.8, 4: 17, 5: 58 },
    WILD: { 3: 7.2, 4: 21, 5: 72 },
  },
  wildSubstitutesScatter: false,
  scatterTriggerCount: 3,
  bonusSpinCount: 10,
  bonusPayMultiplier: 1.5,
  maxPayoutMult: 2000,
  winTiers: { big: 10, mega: 25, epic: 50 },
  broadcastMinMultiplier: 8,
  betPresets: [10, 20, 50, 100, 200, 500],
  minBet: 10,
  maxBet: 500,
  autoplayEnabled: true,
};

export const ANIMATION_CONFIG: SlotAnimationConfig = {
  // Kısa tek geçiş — kartlar hızlı ve temiz yerine oturur
  spinAccelMs: 45,
  spinCruiseMs: 110,
  spinDecelMs: 155,
  overshootPx: 0,
  settleMs: 0,
  stopOffsetsMs: {
    reel0: 0,
    reel1: 32,
    reel2: 64,
    reel3: 96,
    reel4: 128,
  },
  winPulseMs: 480,
  lineShowMs: 560,
  bigWinCountMs: 2200,
  symbolHeight: 78,
};

export const WIN_TIER_LABELS: Record<SlotWinTier, string> = {
  NONE: '',
  NORMAL_WIN: 'KAZANÇ',
  BIG_WIN: 'BÜYÜK KAZANÇ',
  MEGA_WIN: 'MEGA KAZANÇ',
  EPIC_WIN: 'EPİK KAZANÇ',
};

export function classifyWinTier(
  winMultiplier: number,
  config: SlotMathConfig = DEFAULT_MATH_CONFIG,
): SlotWinTier {
  if (winMultiplier <= 0) return 'NONE';
  if (winMultiplier >= config.winTiers.epic) return 'EPIC_WIN';
  if (winMultiplier >= config.winTiers.mega) return 'MEGA_WIN';
  if (winMultiplier >= config.winTiers.big) return 'BIG_WIN';
  return 'NORMAL_WIN';
}

export const CHANNEL_VOLUMES = {
  MASTER: 1,
  MUSIC: 0.16,
  EFFECTS: 0.82,
  UI: 0.72,
  WIN: 0.92,
  AMBIENT: 0.1,
} as const;
