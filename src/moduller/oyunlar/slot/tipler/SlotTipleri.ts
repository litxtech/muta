/**
 * NOX REELS — 5×3 klasik payline slot tipleri.
 * Client sonucu üretmez; sunucu sonucu yalnızca animasyon için kullanılır.
 */

import type { ImageSourcePropType } from 'react-native';

export type SlotSymbolId =
  | 'J'
  | 'Q'
  | 'K'
  | 'A'
  | 'GEM'
  | 'RING'
  | 'CROWN'
  | 'WATCH'
  | 'DIAMOND'
  | 'ROYAL_CROWN'
  | 'WILD'
  | 'SCATTER';

export type SlotRarity = 'low' | 'mid' | 'high' | 'special';

export type SlotAnimationType =
  | 'idle'
  | 'pulse'
  | 'glow'
  | 'sparkle'
  | 'wild'
  | 'scatter';

export type SlotSoundType =
  | 'low'
  | 'mid'
  | 'high'
  | 'wild'
  | 'scatter'
  | 'win'
  | 'big_win';

export type SlotSymbolDef = {
  id: SlotSymbolId;
  name: string;
  rarity: SlotRarity;
  animationType: SlotAnimationType;
  soundType?: SlotSoundType;
  /** PNG varsa; yoksa prosedürel render */
  asset?: ImageSourcePropType;
  tint: string;
};

export type SlotWinTier = 'NONE' | 'NORMAL_WIN' | 'BIG_WIN' | 'MEGA_WIN' | 'EPIC_WIN';

export type SlotPhase =
  | 'IDLE'
  | 'REQUESTING'
  | 'SPINNING'
  | 'STOPPING'
  | 'EVALUATING'
  | 'WIN_ANIMATION'
  | 'BIG_WIN'
  | 'BONUS_INTRO'
  | 'BONUS_SPINNING'
  | 'ERROR'
  | 'RECOVERING';

export type SlotQualityMode = 'HIGH' | 'MEDIUM' | 'LOW';

export type SlotPaylineWin = {
  lineIndex: number;
  symbol: SlotSymbolId;
  count: number;
  positions: Array<{ reel: number; row: number }>;
  payout: number;
  multiplier: number;
};

export type SlotGrid = SlotSymbolId[][]; // [reel][row] — 5×3

export type SlotSpinResult = {
  roundId: string;
  sessionId: string;
  betAmount: number;
  winAmount: number;
  balanceBefore: number;
  balanceAfter: number;
  grid: SlotGrid;
  lineWins: SlotPaylineWin[];
  scatterCount: number;
  wildPositions: Array<{ reel: number; row: number }>;
  bonusTriggered: boolean;
  bonusSpinsAwarded: number;
  remainingBonusSpins: number;
  isBonusSpin: boolean;
  winTier: SlotWinTier;
  winMultiplier: number;
  rngSeed: string;
  mathVersion: string;
  configVersion: string;
  paytableVersion: string;
  adminTest?: boolean;
};

export type SlotMathConfig = {
  mathVersion: string;
  paytableVersion: string;
  configVersion: string;
  reels: number;
  rows: number;
  /** Her makara için ağırlıklı sembol şeridi */
  reelStrips: SlotSymbolId[][];
  /** Payline: her makara için satır indeksi (0=üst) */
  paylines: number[][];
  /** Bahis çarpanı: 3/4/5 eşleşme */
  paytable: Partial<Record<SlotSymbolId, { 3: number; 4: number; 5: number }>>;
  wildSubstitutesScatter: boolean;
  scatterTriggerCount: number;
  bonusSpinCount: number;
  bonusPayMultiplier: number;
  maxPayoutMult: number;
  winTiers: {
    big: number;
    mega: number;
    epic: number;
  };
  /** Büyük kazanç yayın eşiği (win/bet) */
  broadcastMinMultiplier: number;
  betPresets: number[];
  minBet: number;
  maxBet: number;
  autoplayEnabled: boolean;
};

export type SlotReelStopOffsetsMs = {
  reel0: number;
  reel1: number;
  reel2: number;
  reel3: number;
  reel4: number;
};

export type SlotAnimationConfig = {
  spinAccelMs: number;
  spinCruiseMs: number;
  spinDecelMs: number;
  overshootPx: number;
  settleMs: number;
  stopOffsetsMs: SlotReelStopOffsetsMs;
  winPulseMs: number;
  lineShowMs: number;
  bigWinCountMs: number;
  symbolHeight: number;
};

export type PerformanceProfile = SlotQualityMode;
