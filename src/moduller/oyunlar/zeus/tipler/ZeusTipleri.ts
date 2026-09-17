/**
 * ZEUS — paylaşılan tip sözleşmesi.
 * SERVER sonuç üretir; CLIENT yalnızca oynatır.
 */

export type ZeusSymbolType =
  | 'blueDiamond'
  | 'greenEmerald'
  | 'purpleGem'
  | 'redRuby'
  | 'goldCrown'
  | 'goldRing'
  | 'goldGoblet'
  | 'lyre'
  | 'pegasus'
  | 'zeusScatter'
  | 'multiplierOrb';

export type ZeusWinTier =
  | 'NONE'
  | 'NORMAL'
  | 'NICE'
  | 'BIG'
  | 'MEGA'
  | 'SENSATIONAL';

export type ZeusPhase =
  | 'BOOT'
  | 'PRELOAD'
  | 'READY'
  | 'BETTING'
  | 'SPIN_REQUEST'
  | 'SPINNING'
  | 'LANDING'
  | 'EVALUATE'
  | 'WIN_HIGHLIGHT'
  | 'EXPLOSION'
  | 'CASCADE'
  | 'MULTIPLIER'
  | 'SCATTER_CHECK'
  | 'FREE_SPIN_TRIGGER'
  | 'FREE_SPIN'
  | 'RETRIGGER'
  | 'BIG_WIN'
  | 'ROUND_END'
  | 'RECOVERY'
  | 'ERROR';

export type ZeusCharacterState =
  | 'IDLE'
  | 'WATCH'
  | 'CHARGE'
  | 'LIGHTNING'
  | 'WIN'
  | 'BIG_WIN'
  | 'FREE_SPIN'
  | 'RETRIGGER';

export type PerformanceProfile = 'HIGH' | 'MEDIUM' | 'LOW';
export type GameSpeedMode = 'normal' | 'fast';

export type GridCell = {
  id: string;
  type: ZeusSymbolType;
  column: number;
  row: number;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
  state: 'idle' | 'dropping' | 'matched' | 'exploding' | 'dimmed';
  zIndex: number;
  instanceId: string;
  multiplierValue: number | null;
};

export type GridMatrix = GridCell[][];

export type MatchedCluster = {
  symbolType: ZeusSymbolType;
  cellIds: string[];
  count: number;
  payMult: number;
  winAmount: number;
};

export type CascadeStep = {
  cascadeIndex: number;
  gridBefore: GridMatrix;
  matched: MatchedCluster[];
  removedIds: string[];
  winAmount: number;
  multipliersOnBoard: number[];
  newSymbols: GridCell[];
  gridAfter: GridMatrix;
};

export type BonusAward = {
  scatterCount: number;
  freeSpins: number;
};

export type ZeusSpinResult = {
  roundId: string;
  sessionId: string;
  mathVersion: string;
  configVersion: string;
  paytableVersion: string;
  rngSeed: string;
  betAmount: number;
  initialGrid: GridMatrix;
  cascades: CascadeStep[];
  sequenceBaseWin: number;
  appliedMultiplier: number;
  orbValues: number[];
  totalWin: number;
  winTier: ZeusWinTier;
  bonusTriggered: boolean;
  bonus: BonusAward | null;
  retriggered: boolean;
  retriggerSpins: number;
  persistentMultiplierBefore: number;
  persistentMultiplierAfter: number;
  scatterCount: number;
  balanceBefore: number;
  balanceAfter: number;
  remainingFreeSpins: number;
  isFreeSpin: boolean;
};

export type SymbolPayBand = {
  8: number;
  10: number;
  12: number;
};

export type SymbolPaytable = Partial<Record<ZeusSymbolType, SymbolPayBand>>;

export type MultiplierWeight = {
  value: number;
  weight: number;
};

export type WinTierThresholds = {
  nice: number;
  big: number;
  mega: number;
  sensational: number;
};

export type ZeusMathConfig = {
  mathVersion: string;
  paytableVersion: string;
  configVersion: string;
  columns: number;
  rows: number;
  minMatchCount: number;
  paytable: SymbolPaytable;
  symbolWeights: Partial<Record<ZeusSymbolType, number>>;
  multiplierWeights: MultiplierWeight[];
  multiplierSpawnChance: number;
  scatterSpawnChance: number;
  freeSpinTriggerCount: number;
  freeSpinReward: number;
  retriggerMinCount: number;
  retriggerReward: number;
  bonus: {
    persistentMultiplier: boolean;
    multiplierSpawnChance: number;
  };
  maxCascades: number;
  maxEvents: number;
  maxPayoutMult: number;
  winTiers: WinTierThresholds;
  betPresets: number[];
  minBet: number;
  maxBet: number;
  autoplayEnabled: boolean;
  turboEnabled: boolean;
};

export type ZeusSpinRequest = {
  betAmount: number;
  requestId: string;
  gameVersion: string;
  roomId?: string | null;
  adminTest?: boolean;
};

export type AutoplayStopReason =
  | 'user'
  | 'bonus'
  | 'big_win'
  | 'insufficient_balance'
  | 'server_error'
  | 'complete';
