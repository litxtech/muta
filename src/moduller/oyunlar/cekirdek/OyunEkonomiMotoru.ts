/**
 * Oyun ekonomi motoru — saf fonksiyonlar.
 * Client wallet mutate etmez; yalnızca politika / snapshot üretir.
 */

import type {
  ConfigSnapshot,
  EconomyMode,
  EffectiveEconomyPolicy,
  GameControlConfig,
  GameControlOverride,
  PlayerTier,
} from '../ortak/tipler/OyunTipleri';
import {
  NEW_PLAYER_ENTRY_CAPS,
  NEW_PLAYER_GAMES_THRESHOLD,
} from '../ortak/sabitler/OyunSabitleri';
function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function positiveOr(n: number, fallback: number): number {
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function overrideActive(
  override: GameControlOverride | null | undefined,
  now: Date,
): boolean {
  if (!override) return false;
  const start = Date.parse(override.starts_at);
  const end = Date.parse(override.ends_at);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  const t = now.getTime();
  return t >= start && t <= end;
}

export function resolveEffectivePolicy(
  config: GameControlConfig,
  override: GameControlOverride | null | undefined,
  playerTier: PlayerTier,
  now: Date = new Date(),
): EffectiveEconomyPolicy {
  const useOverride = overrideActive(override, now);
  const mode: EconomyMode =
    (useOverride ? override?.mode : null) ?? config.mode ?? 'NORMAL';

  let minEntry = useOverride && override?.min_entry != null ? override.min_entry : config.min_entry;
  let maxEntry = useOverride && override?.max_entry != null ? override.max_entry : config.max_entry;

  if (playerTier === 'NEW' || playerTier === 'RESTRICTED') {
    maxEntry = Math.min(maxEntry, config.new_player_max_entry || NEW_PLAYER_ENTRY_CAPS[2]!.maxEntry);
  }

  if (minEntry > maxEntry) {
    minEntry = maxEntry;
  }

  return {
    mode,
    minEntry: Math.max(0, minEntry),
    maxEntry: Math.max(0, maxEntry),
    rewardMultiplier: positiveOr(
      (useOverride ? override?.reward_multiplier : null) ?? config.reward_multiplier,
      1,
    ),
    xpMultiplier: positiveOr(
      (useOverride ? override?.xp_multiplier : null) ?? config.xp_multiplier,
      1,
    ),
    trophyMultiplier: positiveOr(
      (useOverride ? override?.trophy_multiplier : null) ?? config.trophy_multiplier,
      1,
    ),
    rewardFactor: clamp(
      (useOverride ? override?.reward_factor : null) ?? config.reward_factor ?? 1,
      0,
      1,
    ),
    newPlayerProtection: playerTier === 'NEW',
    dailyRewardCap: Math.max(0, config.daily_reward_cap),
    playerDailyRewardCap: Math.max(0, config.player_daily_reward_cap),
    isEnabled: config.is_enabled && mode !== 'MAINTENANCE',
  };
}

export function applyMultipliers(
  base: { xp: number; trophies: number; reward: number },
  policy: EffectiveEconomyPolicy,
): { xp: number; trophies: number; reward: number } {
  if (policy.mode === 'NO_REWARD' || policy.mode === 'MAINTENANCE') {
    return { xp: 0, trophies: 0, reward: 0 };
  }

  const factor = policy.mode === 'LOW_REWARD' ? policy.rewardFactor : 1;

  return {
    xp: Math.floor(base.xp * policy.xpMultiplier * factor),
    trophies: Math.floor(base.trophies * policy.trophyMultiplier * factor),
    reward: Math.floor(base.reward * policy.rewardMultiplier * factor),
  };
}

export function clampEntry(amount: number, policy: EffectiveEconomyPolicy): number {
  const rounded = Math.floor(amount);
  if (!Number.isFinite(rounded) || rounded < 0) return policy.minEntry;
  return clamp(rounded, policy.minEntry, policy.maxEntry);
}

export function newPlayerMaxEntry(gamesPlayed: number): number {
  const played = Math.max(0, Math.floor(gamesPlayed));
  if (played >= NEW_PLAYER_GAMES_THRESHOLD) {
    return Number.POSITIVE_INFINITY;
  }
  // 0–3 → 500, 4–6 → 1000, 7–9 → 2500
  for (const row of NEW_PLAYER_ENTRY_CAPS) {
    if (played <= row.maxGames) return row.maxEntry;
  }
  return NEW_PLAYER_ENTRY_CAPS[NEW_PLAYER_ENTRY_CAPS.length - 1]!.maxEntry;
}

export function buildConfigSnapshot(params: {
  policy: EffectiveEconomyPolicy;
  entry: number;
  version: string;
  now?: Date;
}): ConfigSnapshot {
  const now = params.now ?? new Date();
  return {
    mode: params.policy.mode,
    entry: clampEntry(params.entry, params.policy),
    rewardMultiplier: params.policy.rewardMultiplier,
    xpMultiplier: params.policy.xpMultiplier,
    trophyMultiplier: params.policy.trophyMultiplier,
    rewardFactor: params.policy.rewardFactor,
    newPlayerProtection: params.policy.newPlayerProtection,
    dailyRewardCap: params.policy.dailyRewardCap,
    playerDailyRewardCap: params.policy.playerDailyRewardCap,
    version: params.version,
    capturedAt: now.toISOString(),
  };
}

export const OyunEkonomiMotoru = {
  resolveEffectivePolicy,
  applyMultipliers,
  clampEntry,
  newPlayerMaxEntry,
  buildConfigSnapshot,
} as const;
