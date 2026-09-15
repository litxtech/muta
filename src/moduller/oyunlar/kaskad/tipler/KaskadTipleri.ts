/**
 * TAMUSO: REALM OF STORMS — paylaşılan tip sözleşmesi.
 * SERVER sonuç üretir; CLIENT yalnızca oynatır (presentation).
 */

/** Düşük değerli kristaller + yüksek değerli fırtına kalıntıları + özel semboller */
export type KaskadSymbolType =
  | 'blueCrystal'
  | 'greenCrystal'
  | 'purpleCrystal'
  | 'redCrystal'
  | 'goldCrystal'
  | 'stormRing'
  | 'celestialCup'
  | 'timeCore'
  | 'energyCrown'
  | 'portalScatter'
  | 'stormMultiplier';

export type WinTier = 'NONE' | 'STORM' | 'THUNDER' | 'COSMIC' | 'DIVINE';

/** Round playback state machine durumları */
export type KaskadPhase =
  | 'IDLE'
  | 'LOADING'
  | 'REQUESTING_RESULT'
  | 'SPIN_START'
  | 'SYMBOLS_DROP'
  | 'MATCH_CHECK'
  | 'WIN_HIGHLIGHT'
  | 'DESTROY'
  | 'CASCADE'
  | 'MULTIPLIER_REVEAL'
  | 'MULTIPLIER_COLLECT'
  | 'SCATTER_CHECK'
  | 'ANTICIPATION'
  | 'BONUS_INTRO'
  | 'BONUS_MODE'
  | 'RETRIGGER'
  | 'BIG_WIN'
  | 'FINALIZE'
  | 'ERROR';

/** Fırtına Muhafızı karakter durumları */
export type CharacterState =
  | 'IDLE'
  | 'WATCHING'
  | 'CAST_SMALL'
  | 'CAST_MEDIUM'
  | 'CAST_LARGE'
  | 'BONUS_TRIGGER'
  | 'BIG_WIN'
  | 'SUPER_WIN'
  | 'RETURN_IDLE';

export type PerformanceProfile = 'HIGH' | 'MEDIUM' | 'LOW';

export type GameSpeedMode = 'normal' | 'fast';

export type GridCell = {
  id: string;
  symbolType: KaskadSymbolType;
  row: number;
  column: number;
  /** Stabil animasyon kimliği — index bazlı key kullanılmaz */
  instanceId: string;
  /** stormMultiplier değeri; diğer sembollerde null */
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
  /** Bonus sırasında yeniden tetikleme (+spin) */
  retriggered: boolean;
  retriggerSpins: number;
  /** Bonus boyunca taşınan kalıcı çarpan (bonus dışında 0) */
  persistentMultiplierBefore: number;
  persistentMultiplierAfter: number;
  /** Final griddeki scatter sayısı (anticipation presentation için) */
  scatterCount: number;
  balanceAfter: number;
  remainingBonusSpins: number;
  isBonusSpin: boolean;
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
  storm: number;
  thunder: number;
  cosmic: number;
  divine: number;
};

export type RetriggerConfig = {
  /** Bonus sırasında retrigger için gereken minimum scatter */
  minScatters: number;
  extraSpins: number;
};

export type BonusMathConfig = {
  /** Bonus boyunca çarpanlar kalıcı toplanır mı */
  persistentMultiplier: boolean;
  /** Bonus modunda multiplier spawn şansı (base'den farklı olabilir) */
  multiplierSpawnChance: number;
  retrigger: RetriggerConfig;
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
  bonus: BonusMathConfig;
  maxCascades: number;
  /** Round başına maksimum event guard'ı */
  maxEvents: number;
  maxPayoutMult: number;
  winTiers: WinTierThresholds;
  betPresets: number[];
  minBet: number;
  maxBet: number;
  autoplayEnabled: boolean;
  turboEnabled: boolean;
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
