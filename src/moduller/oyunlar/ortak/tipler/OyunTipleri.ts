/**
 * Tamuso — Meyve Oyunu (fruit_wheel) paylaşılan kontrol / oda tipleri.
 */

export type GameCode = 'fruit_wheel' | (string & {});

export type EconomyMode =
  | 'NORMAL'
  | 'PROMOTION'
  | 'LOW_REWARD'
  | 'NO_REWARD'
  | 'MAINTENANCE';

export type GameControlConfig = {
  id: string;
  game_code: GameCode;
  is_enabled: boolean;
  mode: EconomyMode;
  min_entry: number;
  max_entry: number;
  reward_multiplier: number;
  xp_multiplier: number;
  trophy_multiplier: number;
  reward_factor: number;
  new_player_games: number;
  new_player_max_entry: number;
  daily_reward_cap: number;
  player_daily_reward_cap: number;
  min_players: number;
  max_players: number;
  default_duration_seconds: number;
  /** Şeffaf coin havuz ödülü — gizli sonuç müdahalesi yok */
  coin_rewards_enabled: boolean;
  starts_at: string | null;
  ends_at: string | null;
  updated_at: string;
};

export type GameControlOverride = {
  id: string;
  game_code: GameCode;
  mode: EconomyMode | null;
  reward_multiplier: number | null;
  xp_multiplier: number | null;
  trophy_multiplier: number | null;
  reward_factor: number | null;
  min_entry: number | null;
  max_entry: number | null;
  starts_at: string;
  ends_at: string;
  reason: string | null;
};

export type RoomGameMeta = {
  roomId: string;
  roomName: string;
  participantCount: number;
  micEnabled: boolean;
};

export type RpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; hata: string };
