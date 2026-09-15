/**
 * Tamuso Games — paylaşılan sabitler (oyuncu limiti, XP, kupa, lig).
 */

import type { LeagueDivision, LeagueTierCode } from '../tipler/OyunTipleri';

export const OYUN_MODUL_ADI = 'oyunlar' as const;

/** Solo pratik + çok oyunculu; sunucu game_configs.min_players ile hizalı */
export const MIN_PLAYERS = 1;
export const MAX_PLAYERS = 8;

export const DEFAULT_DURATION_SECONDS = 90;
export const DURATION_OPTIONS_SECONDS = [60, 90, 120, 180] as const;

export const LOBBY_COUNTDOWN_SECONDS = 10;
export const START_COUNTDOWN_SECONDS = 3;

/** Skor realtime / RPC throttle */
export const SCORE_THROTTLE_MS = 400;

/** Bağlantı kopunca yeniden bağlanma süresi */
export const RECONNECT_SECONDS = 15;

/** Liderlik bildirimi spam koruması */
export const LEADER_CHANGE_COOLDOWN_MS = 3000;

export const NEW_PLAYER_GAMES_THRESHOLD = 10;

export const NEW_PLAYER_ENTRY_CAPS: ReadonlyArray<{ maxGames: number; maxEntry: number }> = [
  { maxGames: 3, maxEntry: 500 },
  { maxGames: 6, maxEntry: 1000 },
  { maxGames: 10, maxEntry: 2500 },
];

export const XP_REWARDS = {
  join: 10,
  complete: 20,
  rank3: 30,
  rank2: 50,
  rank1: 80,
} as const;

export const TROPHY_REWARDS = {
  rank1: 25,
  rank2: 15,
  rank3: 10,
  other: 3,
  quit: 0,
} as const;

export type LeagueTierDef = {
  code: LeagueTierCode;
  label: string;
  minTrophies: number;
  divisions: LeagueDivision[];
};

export const LEAGUE_TIERS: readonly LeagueTierDef[] = [
  { code: 'bronze', label: 'Bronz', minTrophies: 0, divisions: [3, 2, 1] },
  { code: 'silver', label: 'Gümüş', minTrophies: 200, divisions: [3, 2, 1] },
  { code: 'gold', label: 'Altın', minTrophies: 500, divisions: [3, 2, 1] },
  { code: 'platinum', label: 'Platin', minTrophies: 1000, divisions: [3, 2, 1] },
  { code: 'diamond', label: 'Elmas', minTrophies: 2000, divisions: [3, 2, 1] },
  { code: 'master', label: 'Usta', minTrophies: 4000, divisions: [1] },
  { code: 'legend', label: 'Tamuso Efsanesi', minTrophies: 7000, divisions: [1] },
] as const;

export function ligEtiketi(trophies: number): string {
  let current = LEAGUE_TIERS[0]!;
  for (const tier of LEAGUE_TIERS) {
    if (trophies >= tier.minTrophies) current = tier;
  }
  if (current.divisions.length === 1) return current.label;

  const next = LEAGUE_TIERS.find((t) => t.minTrophies > current.minTrophies);
  const span = (next?.minTrophies ?? current.minTrophies + 600) - current.minTrophies;
  const progress = trophies - current.minTrophies;
  const third = Math.max(1, Math.floor(span / 3));
  let division: LeagueDivision = 3;
  if (progress >= third * 2) division = 1;
  else if (progress >= third) division = 2;
  return `${current.label} ${roman(division)}`;
}

function roman(d: LeagueDivision): string {
  return d === 1 ? 'I' : d === 2 ? 'II' : 'III';
}

export const GAME_CHANNEL_PREFIX = 'game:' as const;

export function gameChannelName(sessionId: string): string {
  return `${GAME_CHANNEL_PREFIX}${sessionId}`;
}
