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
  withdrawals_enabled: true,
  city_league_enabled: true,
  city_battles_enabled: true,
  city_elections_enabled: true,
  messages_enabled: true,
  events_enabled: true,
  missions_enabled: true,
  announcements_enabled: true,
  auto_promo_banners_enabled: true,
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
};

export function OzellikBayragiAktifMi(anahtar: OzellikBayragiAnahtari): boolean {
  return yerelBayraklar[anahtar] ?? false;
}

export function KillSwitchAktifMi(anahtar: KillSwitchAnahtari): boolean {
  return yerelKillSwitch[anahtar] ?? false;
}
