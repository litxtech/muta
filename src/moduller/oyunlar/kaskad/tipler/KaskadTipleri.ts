/**
 * Kozmik Kaskad — paylaşılan tip sözleşmesi.
 * SERVER sonuç üretir; CLIENT yalnızca oynatır.
 */

export type KaskadSymbolType =
  | 'crystalBlue'
  | 'crystalViolet'
  | 'crystalMint'
  | 'crystalAmber'
  | 'starCore'
  | 'cosmicEye'
  | 'galaxyOrb'
  | 'energyCrown'
  | 'portalScatter'
  | 'multiplierOrb';

export type WinTier =
  | 'NONE'
  | 'ENERGY'
  | 'COSMIC'
  | 'GALACTIC'
  | 'SUPERNOVA';

export type KaskadPhase =
  | 'IDLE'
  | 'LOADING'
  | 'REQUESTING_RESULT'
  | 'SPIN_START'
  | 'SYMBOLS_DROP'
  | 'MATCH_CHECK'
  | 'WIN_ANIMATION'
  | 'DESTROY'
  | 'CASCADE'
  | 'MULTIPLIER'
  | 'SCATTER_CHECK'
  | 'BONUS_INTRO'
  | 'BONUS_MODE'
  | 'BIG_WIN'
  | 'FINALIZE'
  | 'ERROR';

export type PerformanceProfile = 'HIGH' | 'MEDIUM' | 'LOW';

export type GameSpeedMode = 'normal' | 'fast';

export type GridCell = {
  id: string;
  symbolType: KaskadSymbolType;
  row: number;
  column: number;
  instanceId: string;
  /** Multiplier orb değeri; diğer sembollerde null */
  multiplierValue: number | null;
};

export type GridMatrix = GridCell[][];

export type MatchedCluster = {
  symbolType: KaskadSymbolType;
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
  multipliers: number[];
  newSymbols: GridCell[];
  gridAfter: GridMatrix;
};

export type BonusAward = {
  scatterCount: number;
  freeSpins: number;
};

export type SpinResult = {
  roundId: string;
  sessionId: string;
  mathVersion: string;
  configVersion: string;
  paytableVersion: string;
  rngSeed: string;
  betAmount: number;
  initialGrid: GridMatrix;
  cascades: CascadeStep[];
  totalMultiplier: number;
  baseWin: number;
  totalWin: number;
  winTier: WinTier;
  bonusTriggered: boolean;
  bonus: BonusAward | null;
  balanceAfter: number;
  remainingBonusSpins: number;
};

export type SymbolPayBand = {
  8: number;
  10: number;
  12: number;
};

export type SymbolPaytable = Partial<Record<KaskadSymbolType, SymbolPayBand>>;

export type MultiplierWeight = {
  value: number;
  weight: number;
};

export type ScatterBonusTable = {
  4: number;
  5: number;
  6: number;
};

export type WinTierThresholds = {
  energy: number;
  cosmic: number;
  galactic: number;
  supernova: number;
};

export type KaskadMathConfig = {
  mathVersion: string;
  paytableVersion: string;
  configVersion: string;
  columns: number;
  rows: number;
  minMatchCount: number;
  paytable: SymbolPaytable;
  symbolWeights: Partial<Record<KaskadSymbolType, number>>;
  multiplierWeights: MultiplierWeight[];
  multiplierSpawnChance: number;
  scatterSpawnChance: number;
  scatterBonus: ScatterBonusTable;
  maxCascades: number;
  maxPayoutMult: number;
  winTiers: WinTierThresholds;
  betPresets: number[];
  minBet: number;
  maxBet: number;
};

export type AutoplayStopReason =
  | 'user'
  | 'bonus'
  | 'big_win'
  | 'insufficient_balance'
  | 'server_error'
  | 'complete';

export type KaskadSpinRequest = {
  betAmount: number;
  idempotencyKey: string;
  roomId?: string | null;
  bonusSessionId?: string | null;
  speedMode?: GameSpeedMode;
};
