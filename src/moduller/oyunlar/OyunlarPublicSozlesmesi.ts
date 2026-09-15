/**
 * Tamuso Games — public sözleşme.
 * Diğer modüller yalnızca bu yüzey üzerinden oyun API'sine bağlanır.
 */

export const OYUNLAR_MODUL_ADI = 'oyunlar' as const;

export type {
  GameCode,
  GameSessionStatus,
  GamePlayerStatus,
  EconomyMode,
  PlayerTier,
  GameControlConfig,
  GameControlOverride,
  EffectiveEconomyPolicy,
  ConfigSnapshot,
  GameDefinition,
  GameSession,
  GameSessionPlayer,
  LeaderboardEntry,
  GameRealtimeEvent,
  RoomGameMeta,
  CreateGameSessionParams,
  JoinGameSessionParams,
  SubmitGameScoreParams,
  RpcResult,
} from './ortak/tipler/OyunTipleri';

export {
  MIN_PLAYERS,
  MAX_PLAYERS,
  DEFAULT_DURATION_SECONDS,
  DURATION_OPTIONS_SECONDS,
  SCORE_THROTTLE_MS,
  RECONNECT_SECONDS,
  XP_REWARDS,
  TROPHY_REWARDS,
  LEAGUE_TIERS,
  ligEtiketi,
  gameChannelName,
  OYUN_MODUL_ADI,
} from './ortak/sabitler/OyunSabitleri';

export {
  registerGame,
  getGame,
  listGames,
  requireGame,
  OyunKayitSistemi,
} from './cekirdek/OyunKayitSistemi';

export {
  resolveEffectivePolicy,
  applyMultipliers,
  clampEntry,
  newPlayerMaxEntry,
  buildConfigSnapshot,
  OyunEkonomiMotoru,
} from './cekirdek/OyunEkonomiMotoru';

export {
  resolvePlayerTier,
  isNewPlayerProtected,
  OyunOyuncuKatmani,
} from './cekirdek/OyunOyuncuKatmani';

export { GameLogger, OyunLogger } from './cekirdek/OyunLogger';

export {
  createGameSession,
  joinGameSession,
  startGameSession,
  submitGameScore,
  finishGameSession,
  OyunOturumServisi,
} from './ortak/servisler/OyunOturumServisi';

export {
  fetchGameControl,
  listVisibleGameCodes,
  isGameVisible,
  OyunKontrolServisi,
} from './ortak/servisler/OyunKontrolServisi';

export { useOyunOturumu } from './ortak/hooks/useOyunOturumu';
export { useCanliSkor } from './ortak/hooks/useCanliSkor';
export { useGorunurOyunKodlari } from './ortak/hooks/useGorunurOyunKodlari';
export { useOdaOyunDaveti } from './ortak/hooks/useOdaOyunDaveti';

export { OyunDavetiModal } from './ortak/bilesenler/OyunDavetiModal';
export { OyunBaslatModal } from './ortak/bilesenler/OyunBaslatModal';
export { OyunLobisi } from './ortak/bilesenler/OyunLobisi';
export { CanliSkorPaneli } from './ortak/bilesenler/CanliSkorPaneli';
export { OyunSonucuModal } from './ortak/bilesenler/OyunSonucuModal';
export { GeriSayim } from './ortak/bilesenler/GeriSayim';
export { MiniOdaSeridi } from './ortak/bilesenler/MiniOdaSeridi';

export { OyunOdaKatmani } from './oda/OyunOdaKatmani';
export type { OyunOdaKatmaniProps } from './oda/OyunOdaKatmani';

export { registerMatch3 } from './eslestirme/Match3Kayit';
export { KristalSavasiEkrani } from './eslestirme/ekranlar/KristalSavasiEkrani';
export { createBoard } from './eslestirme/motor/TahtaOlusturucu';
export { createSeededRandom, mulberry32 } from './eslestirme/motor/SeedMotoru';
export { applyMove } from './eslestirme/motor/HamleMotoru';
export { boardHash } from './eslestirme/motor/TahtaHash';
export {
  GAME_CODE as MATCH3_GAME_CODE,
  GAME_VERSION as MATCH3_GAME_VERSION,
  GAME_DISPLAY_NAME,
} from './eslestirme/sabitler/KristalSabitleri';

export { registerKozmikKaskad } from './kaskad/KaskadKayit';
export { KozmikKaskadEkrani } from './kaskad/ekranlar/KozmikKaskadEkrani';
export {
  GAME_CODE as KASKAD_GAME_CODE,
  GAME_VERSION as KASKAD_GAME_VERSION,
  GAME_DISPLAY_NAME as KASKAD_DISPLAY_NAME,
} from './kaskad/sabitler/KaskadSabitleri';
export { simulateSpin, runBatchSimulation } from './kaskad/motor/SpinSimulator';
export { DEFAULT_MATH_CONFIG } from './kaskad/sabitler/KaskadSabitleri';
