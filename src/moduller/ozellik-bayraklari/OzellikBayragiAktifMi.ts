import type {
  KillSwitchAnahtari,
  OzellikBayragiAnahtari,
} from './OzellikBayragiAnahtarlari';

/**
 * Yerel varsayilanlar — FAZ 2'de Supabase remote config ile degisir.
 * Production'da server degeri kazanir.
 */
const yerelBayraklar: Record<OzellikBayragiAnahtari, boolean> = {
  voice_rooms_enabled: true,
  live_enabled: true,
  video_enabled: true,
  gifts_enabled: true,
  pk_enabled: true,
  agency_enabled: true,
  withdrawals_enabled: false,
  wallet_exchange_enabled: false,
  wallet_sell_enabled: false,
  wallet_withdraw_enabled: false,
  city_league_enabled: true,
  city_battles_enabled: true,
  city_elections_enabled: true,
  messages_enabled: true,
  events_enabled: true,
  missions_enabled: true,
  announcements_enabled: true,
  auto_promo_banners_enabled: true,
  auto_event_banners_enabled: true,
  policies_enabled: true,
  moderation_enabled: true,
  analytics_enabled: true,
  certification_hub_enabled: true,
  low_end_mode_enabled: false,
  graceful_degradation_enabled: true,
  stress_tools_enabled: true,
  iap_enabled: true,
  stripe_enabled: false,
  games_enabled: true,
  kozmik_kaskad_enabled: true,
  zeus_enabled: true,
  nox_reels_enabled: true,
  voice_room_music_enabled: true,
  music_ducking_enabled: true,
  music_playlists_enabled: true,
  music_favorites_enabled: true,
  ai_music_enabled: true,
  ai_music_reference_enabled: true,
  ai_music_status_share_enabled: true,
  ai_music_voice_room_enabled: true,
  ai_music_export_enabled: true,
  transaction_volume_enabled: true,
  transaction_volume_profile_enabled: true,
  transaction_volume_tiers_enabled: true,
  transaction_volume_leaderboard_enabled: true,
  transaction_volume_effects_enabled: true,
  people_discovery_enabled: true,
  people_personalized_enabled: true,
  people_gender_filter_enabled: true,
  people_country_filter_enabled: true,
  people_online_filter_enabled: true,
  people_price_filter_enabled: true,
  people_message_enabled: true,
  people_voice_call_enabled: true,
  people_video_call_enabled: true,
  people_paid_calling_enabled: true,
  people_show_prices_enabled: true,
  people_show_country_flags: true,
  people_show_online_indicators: true,
};

const yerelKillSwitch: Record<KillSwitchAnahtari, boolean> = {
  kill_coin_purchase: false,
  kill_gift_send: false,
  kill_withdrawal: false,
  kill_agency_coin_transfer: false,
  kill_live: false,
  kill_pk: false,
  kill_moderation: false,
  kill_heavy_animations: false,
  kill_livekit_reconnect: false,
  kill_games: false,
  kill_game_coin: false,
  kill_ai_music_generation: false,
  kill_transaction_volume_display: false,
  kill_people_discovery: false,
  kill_people_paid_calls: false,
};

export function OzellikBayragiAktifMi(anahtar: OzellikBayragiAnahtari): boolean {
  return yerelBayraklar[anahtar] ?? false;
}

export function KillSwitchAktifMi(anahtar: KillSwitchAnahtari): boolean {
  return yerelKillSwitch[anahtar] ?? false;
}
