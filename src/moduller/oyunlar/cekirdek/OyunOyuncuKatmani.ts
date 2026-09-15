/**
 * Oyuncu katmanı — oyun sayısına göre saf tier çözümleme.
 * Kazanma/kaybetmeyi belirlemez; limit / koruma için kullanılır.
 */

import type { PlayerTier } from '../ortak/tipler/OyunTipleri';
import { NEW_PLAYER_GAMES_THRESHOLD } from '../ortak/sabitler/OyunSabitleri';

export type PlayerTierInput = {
  gamesPlayed: number;
  wins?: number;
  trophies?: number;
  isVip?: boolean;
  isRestricted?: boolean;
};

export function resolvePlayerTier(input: PlayerTierInput): PlayerTier {
  if (input.isRestricted) return 'RESTRICTED';
  if (input.isVip) return 'VIP';

  const games = Math.max(0, Math.floor(input.gamesPlayed));
  const wins = Math.max(0, Math.floor(input.wins ?? 0));
  const trophies = Math.max(0, Math.floor(input.trophies ?? 0));

  if (games < NEW_PLAYER_GAMES_THRESHOLD) return 'NEW';
  if (games >= 200 && (wins >= 50 || trophies >= 2000)) return 'EXPERT';
  if (games >= 50) return 'ACTIVE';
  return 'NORMAL';
}

export function isNewPlayerProtected(gamesPlayed: number): boolean {
  return Math.max(0, Math.floor(gamesPlayed)) < NEW_PLAYER_GAMES_THRESHOLD;
}

export const OyunOyuncuKatmani = {
  resolvePlayerTier,
  isNewPlayerProtected,
} as const;
