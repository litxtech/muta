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
  live_enabled: false,
  video_enabled: false,
  gifts_enabled: true,
  pk_enabled: false,
  agency_enabled: false,
  withdrawals_enabled: false,
  city_league_enabled: false,
  city_battles_enabled: false,
  city_elections_enabled: false,
  messages_enabled: true,
  events_enabled: false,
  missions_enabled: false,
  announcements_enabled: false,
  policies_enabled: false,
  moderation_enabled: false,
  analytics_enabled: false,
  certification_hub_enabled: true,
  low_end_mode_enabled: false,
  graceful_degradation_enabled: true,
  stress_tools_enabled: true,
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
};

export function OzellikBayragiAktifMi(anahtar: OzellikBayragiAnahtari): boolean {
  return yerelBayraklar[anahtar] ?? false;
}

export function KillSwitchAktifMi(anahtar: KillSwitchAnahtari): boolean {
  return yerelKillSwitch[anahtar] ?? false;
}
