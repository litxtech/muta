import type {
  BannerAction,
  BannerCampaign,
  BannerMediaType,
  BannerPlacement,
  BannerStatus,
  BannerTarget,
} from '../core/BannerTypes';
import type { BannerSizeType } from '../core/BannerConstants';

export type BannerAdminSavePayload = {
  id?: string;
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
  gradient_json?: Record<string, unknown> | null;
  size_type: BannerSizeType;
  aspect_ratio: string;
  priority: number;
  status: BannerStatus;
  start_at?: string | null;
  end_at?: string | null;
  daily_start_time?: string | null;
  daily_end_time?: string | null;
  dismissible?: boolean;
  frequency_type?: string;
  max_daily_impressions?: number | null;
  max_weekly_impressions?: number | null;
  max_session_impressions?: number | null;
  shimmer_enabled?: boolean;
  autoplay_video?: boolean;
  loop_video?: boolean;
  carousel_auto_slide_ms?: number | null;
  tags?: string[];
  placements?: BannerPlacement[];
  targets?: BannerTarget[];
  actions?: BannerAction[];
};

export type BannerAdminListItem = BannerCampaign;

export const BANNER_STATUS_LABELS: Record<BannerStatus, string> = {
  DRAFT: 'Taslak',
  SCHEDULED: 'Zamanlandı',
  ACTIVE: 'Aktif',
  PAUSED: 'Durduruldu',
  EXPIRED: 'Süresi doldu',
  ARCHIVED: 'Arşiv',
};

export const ACTION_TYPE_LABELS: Record<string, string> = {
  NONE: 'Yok',
  INTERNAL_SCREEN: 'Uygulama ekranı',
  INTERNAL_PROFILE: 'Profil',
  INTERNAL_ROOM: 'Ses odası',
  INTERNAL_GAME: 'Oyun',
  INTERNAL_POST: 'Gönderi',
  INTERNAL_LIVE: 'Canlı yayın',
  WEB_URL: 'Web (iç tarayıcı)',
  IN_APP_WEBVIEW: 'İç WebView',
  WHATSAPP: 'WhatsApp',
  INSTAGRAM: 'Instagram',
  EXTERNAL_APP: 'Harici uygulama',
  CUSTOM_DEEP_LINK: 'Deep link',
};
