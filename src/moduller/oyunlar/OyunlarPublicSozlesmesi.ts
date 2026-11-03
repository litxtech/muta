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
  oyunCuzdanOnizleme,
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
export { OyunAuraCerceve } from './ortak/bilesenler/OyunAuraCerceve';
export {
  OYUN_KART_KATALOGU,
  feedOyunKartlari,
  oyunKartKimligi,
} from './ortak/katalog/OyunKartKatalogu';
export type { OyunKartKimligi } from './ortak/katalog/OyunKartKatalogu';

export { OyunOdaKatmani } from './oda/OyunOdaKatmani';
export type { OyunOdaKatmaniProps } from './oda/OyunOdaKatmani';

export { registerFruitWheel } from './fruit-wheel/FruitWheelKayit';
