/**
 * Server tarafindan yonetilen feature flag anahtarlari.
 * Degerler hard-code business rule degil; remote config.
 */
export const OzellikBayragiAnahtarlari = [
  'voice_rooms_enabled',
  'live_enabled',
  'video_enabled',
  'gifts_enabled',
  'pk_enabled',
  'agency_enabled',
  'withdrawals_enabled',
  'city_league_enabled',
  'city_battles_enabled',
  'city_elections_enabled',
  'messages_enabled',
  'events_enabled',
  'missions_enabled',
  'announcements_enabled',
  'policies_enabled',
  'moderation_enabled',
  'analytics_enabled',
  'certification_hub_enabled',
  'low_end_mode_enabled',
  'graceful_degradation_enabled',
  'stress_tools_enabled',
  'iap_enabled',
  'stripe_enabled',
  'games_enabled',
  'match3_enabled',
  'kozmik_kaskad_enabled',
] as const;

export type OzellikBayragiAnahtari = (typeof OzellikBayragiAnahtarlari)[number];

/** Kritik sistem acil durdurma */
export const KillSwitchAnahtarlari = [
  'kill_coin_purchase',
  'kill_gift_send',
  'kill_withdrawal',
  'kill_agency_coin_transfer',
  'kill_live',
  'kill_pk',
  'kill_moderation',
  'kill_heavy_animations',
  'kill_livekit_reconnect',
  'kill_games',
  'kill_game_coin',
] as const;

export type KillSwitchAnahtari = (typeof KillSwitchAnahtarlari)[number];
