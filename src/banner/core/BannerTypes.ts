import type { BannerSizeType } from './BannerConstants';

export type BannerStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'ACTIVE'
  | 'PAUSED'
  | 'EXPIRED'
  | 'ARCHIVED';

export type BannerMediaType =
  | 'IMAGE'
  | 'VIDEO'
  | 'GRADIENT'
  | 'IMAGE_TEXT'
  | 'VIDEO_TEXT';

export type BannerActionType =
  | 'NONE'
  | 'INTERNAL_SCREEN'
  | 'INTERNAL_PROFILE'
  | 'INTERNAL_ROOM'
  | 'INTERNAL_GAME'
  | 'INTERNAL_POST'
  | 'INTERNAL_LIVE'
  | 'WEB_URL'
  | 'IN_APP_WEBVIEW'
  | 'WHATSAPP'
  | 'INSTAGRAM'
  | 'EXTERNAL_APP'
  | 'CUSTOM_DEEP_LINK';

export type BannerFrequencyType =
  | 'unlimited'
  | '1_per_session'
  | '1_per_day'
  | '3_per_day'
  | '5_per_week'
  | 'custom';

export type BannerTargetMode = 'ALL' | 'COUNTRY' | 'CITY' | 'REGION' | 'CUSTOM';

export type BannerUserSegment =
  | 'ALL_USERS'
  | 'GUEST'
  | 'REGISTERED'
  | 'NEW_USER'
  | 'ACTIVE_USER'
  | 'VIP'
  | 'CREATOR'
  | 'ROOM_HOST'
  | 'CUSTOM_SEGMENT';

export type BannerPlatform = 'ALL' | 'IOS' | 'ANDROID';

export type BannerEventType =
  | 'impression'
  | 'view'
  | 'click'
  | 'cta_click'
  | 'dismiss'
  | 'video_start'
  | 'video_complete'
  | 'webview_open'
  | 'conversion';

export type BannerPlacement = {
  id?: string;
  banner_id?: string;
  screen_key: string;
  placement_key: string;
  sort_order: number;
};

export type BannerTarget = {
  id?: string;
  banner_id?: string;
  target_mode: BannerTargetMode;
  country?: string | null;
  country_code?: string | null;
  region?: string | null;
  region_id?: string | null;
  city?: string | null;
  platform: BannerPlatform;
  language?: string | null;
  user_segment: BannerUserSegment;
  custom_segment?: string | null;
  min_level?: number | null;
  max_level?: number | null;
  min_account_age_days?: number | null;
  max_account_age_days?: number | null;
};

export type BannerAction = {
  id?: string;
  banner_id?: string;
  slot: 0 | 1;
  action_type: BannerActionType;
  button_text?: string | null;
  icon?: string | null;
  target?: string | null;
  url?: string | null;
  payload_json?: Record<string, unknown>;
};

export type BannerCampaign = {
  id: string;
  name: string;
  internal_name?: string | null;
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  badge?: string | null;
  label?: string | null;
  media_type: BannerMediaType;
  media_url?: string | null;
  thumbnail_url?: string | null;
  media_alt?: string | null;
  gradient_json?: { colors?: string[]; start?: string; end?: string } | null;
  size_type: BannerSizeType;
  aspect_ratio: string;
  priority: number;
  status: BannerStatus;
  start_at?: string | null;
  end_at?: string | null;
  daily_start_time?: string | null;
  daily_end_time?: string | null;
  dismissible: boolean;
  frequency_type: BannerFrequencyType;
  max_daily_impressions?: number | null;
  max_weekly_impressions?: number | null;
  max_session_impressions?: number | null;
  shimmer_enabled: boolean;
  autoplay_video: boolean;
  loop_video: boolean;
  carousel_auto_slide_ms?: number | null;
  tags: string[];
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  placements?: BannerPlacement[];
  targets?: BannerTarget[];
  actions?: BannerAction[];
  impression_count?: number;
  click_count?: number;
};

export type BannerUserState = {
  banner_id: string;
  user_id: string;
  dismissed_at?: string | null;
  last_impression_at?: string | null;
  impression_count_today: number;
  impression_count_week: number;
  impression_day?: string | null;
  impression_week_start?: string | null;
  session_impressions: number;
  last_session_id?: string | null;
};

export type BannerUserContext = {
  userId?: string | null;
  isGuest: boolean;
  isHost: boolean;
  isVip?: boolean;
  isCreator?: boolean;
  level: number;
  language: string;
  platform: 'IOS' | 'ANDROID';
  country?: string | null;
  countryCode?: string | null;
  regionId?: string | null;
  city?: string | null;
  accountAgeDays: number;
  sessionId: string;
  now?: Date;
};

export type BannerEligibilityResult = {
  eligible: boolean;
  reasons: string[];
};

export type BannerAnalyticsSummary = {
  impressions: number;
  unique_viewers: number;
  clicks: number;
  unique_clicks: number;
  ctr: number;
  dismiss_count: number;
  video_views: number;
  video_completion: number;
  webview_open: number;
  cta_breakdown: Record<string, number>;
};
