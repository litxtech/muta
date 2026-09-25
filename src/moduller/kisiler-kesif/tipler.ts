/** Kişiler keşfi — public projection + ayarlar tipleri */

export type KisilerKesifSekmesi = 'for_you' | 'female' | 'male';

export type KisilerDiscoveryPreference = 'female' | 'male' | 'everyone';

export type KisilerCallPermission = 'everyone' | 'following' | 'nobody';

export type KisilerCallAvailability = 'AVAILABLE' | 'BUSY' | 'OFFLINE' | 'DO_NOT_DISTURB';

export type KisilerEffectiveFeatures = {
  people_discovery_enabled: boolean;
  personalized_enabled: boolean;
  gender_filter_enabled: boolean;
  country_filter_enabled: boolean;
  online_filter_enabled: boolean;
  price_filter_enabled: boolean;
  message_enabled: boolean;
  voice_call_enabled: boolean;
  video_call_enabled: boolean;
  paid_calling_enabled: boolean;
  show_prices: boolean;
  show_country_flags: boolean;
  show_online_indicators: boolean;
};

export type KisilerConfig = KisilerEffectiveFeatures & {
  algorithm_version: string;
  voice_price_min: number;
  voice_price_max: number;
  video_price_min: number;
  video_price_max: number;
  platform_call_fee: number;
  billing_mode: 'per_second_ceil' | 'per_second_floor' | 'started_minute';
  /** Yeni hesaplara verilen ömür boyu ücretsiz arama hakkı (saniye) */
  free_call_seconds_grant?: number;
  ring_timeout_sec?: number;
  online_window_sec?: number;
  page_size?: number;
  weights?: {
    preference: number;
    online: number;
    recent_activity: number;
    availability: number;
    profile_quality: number;
    relationship: number;
    new_user: number;
    repeat_penalty: number;
  };
  updated_at?: string | null;
};

export type KisilerKesifKarti = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  level: number | null;
  public_country_code: string | null;
  online_display: boolean;
  call_availability: KisilerCallAvailability;
  voice_call_enabled: boolean;
  video_call_enabled: boolean;
  message_enabled: boolean;
  voice_price: number | null;
  video_price: number | null;
  score?: number;
};

export type KisilerAyarlari = {
  user_id: string;
  discoverable: boolean;
  discoverable_raw: boolean;
  discovery_restricted: boolean;
  discovery_preference: KisilerDiscoveryPreference;
  show_country: boolean;
  show_online_status: boolean;
  calls_open: boolean;
  voice_calls_enabled: boolean;
  video_calls_enabled: boolean;
  call_permission: KisilerCallPermission;
  voice_price_per_minute: number;
  video_price_per_minute: number;
  voice_price_min: number;
  voice_price_max: number;
  video_price_min: number;
  video_price_max: number;
  /** Kalan ömür boyu ücretsiz arama (saniye) */
  free_call_seconds_remaining?: number;
  free_call_seconds_grant?: number;
};

export type KisilerAramaOnizleme = {
  ok: boolean;
  error?: string;
  error_code?: string;
  callee_id?: string;
  display_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  call_type?: 'audio' | 'video';
  price_per_minute?: number;
  is_paid?: boolean;
  caller_balance?: number;
  free_seconds_remaining?: number;
  estimated_seconds?: number | null;
  billing_mode?: string;
  platform_call_fee?: number;
  can_start?: boolean;
  calls_open?: boolean;
  block_reason?: string | null;
  message?: string | null;
};

export type KisilerKesifFiltre = {
  tab: KisilerKesifSekmesi;
  countryCode?: string | null;
  onlineOnly?: boolean;
  priceMin?: number | null;
  priceMax?: number | null;
  priceKind?: 'voice' | 'video';
  query?: string | null;
};
