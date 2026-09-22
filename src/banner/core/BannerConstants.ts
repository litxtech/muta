/** Banner size / aspect ratio config — hardcode yok, buradan gelir */

export type BannerSizeType = 'SMALL' | 'MEDIUM' | 'LARGE' | 'HERO' | 'CUSTOM';

export const BANNER_SIZE_PRESETS: Record<
  Exclude<BannerSizeType, 'CUSTOM'>,
  { aspectRatio: string; numeric: number }
> = {
  /** Yatay şerit — feed için varsayılan */
  SMALL: { aspectRatio: '4:1', numeric: 4 / 1 },
  MEDIUM: { aspectRatio: '16:5', numeric: 16 / 5 },
  LARGE: { aspectRatio: '16:6', numeric: 16 / 6 },
  HERO: { aspectRatio: '16:7', numeric: 16 / 7 },
};

/** Feed / otomatik oda tanıtım şeridi */
export const BANNER_STRIP_ASPECT = '4:1';
export const BANNER_STRIP_MAX_HEIGHT = 92;
export const BANNER_COMPACT_MAX_HEIGHT = 92;

/** Otomatik tanıtım placement’ları (oda / canlı / oyun) */
export const AUTO_ROOM_PROMO_PLACEMENTS = {
  oda: 'FEED_AFTER_POST_6',
  canli: 'FEED_AFTER_POST_14',
  oyun: 'HOME_BOTTOM',
} as const;

/** Ana feed: N. içerikten sonra banner slotları */
export const FEED_AUTO_BANNER_AFTER_INDEXES = [6, 14] as const;
/** Geriye uyumluluk */
export const FEED_BANNER_AFTER_INDEXES = FEED_AUTO_BANNER_AFTER_INDEXES;

export const BANNER_CUSTOM_ASPECT_OPTIONS = [
  '4:1',
  '3:1',
  '1.91:1',
  '16:9',
  '2:1',
  '16:5',
  '16:6',
  '16:7',
] as const;

export function parseAspectRatio(ratio: string | null | undefined): number {
  if (!ratio) return BANNER_SIZE_PRESETS.SMALL.numeric;
  const cleaned = ratio.trim().replace(/\s/g, '');
  if (cleaned.includes(':')) {
    const [a, b] = cleaned.split(':').map(Number);
    if (a > 0 && b > 0) return a / b;
  }
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : BANNER_SIZE_PRESETS.SMALL.numeric;
}

export function resolveBannerAspect(
  sizeType: BannerSizeType,
  customRatio?: string | null,
): number {
  if (sizeType === 'CUSTOM') return parseAspectRatio(customRatio);
  return BANNER_SIZE_PRESETS[sizeType]?.numeric ?? BANNER_SIZE_PRESETS.SMALL.numeric;
}

export const BANNER_CACHE_TTL_MS = 90_000;
export const BANNER_IMPRESSION_VISIBLE_RATIO = 0.5;
export const BANNER_IMPRESSION_MIN_MS = 500;
export const BANNER_TAP_MAX_MOVE_PX = 12;
export const BANNER_CAROUSEL_DEFAULT_MS = 3000;
export const BANNER_STORAGE_BUCKET = 'banner-media';
export const BANNER_BORDER_RADIUS = 16;
export const BANNER_BG = 'rgba(24,20,38,0.92)';
export const BANNER_BORDER = 'rgba(255,255,255,0.08)';


export const BANNER_SCREEN_KEYS = [
  'HOME',
  'FEED',
  'DISCOVER',
  'MESSAGES',
  'PROFILE',
  'VOICE_ROOM',
  'GAME_CENTER',
  'SETTINGS',
  'MARKET',
  'LIVE',
] as const;

export type BannerScreenKey = (typeof BANNER_SCREEN_KEYS)[number] | (string & {});

export const BANNER_PLACEMENT_KEYS = [
  'FEED_TOP',
  'FEED_AFTER_POST_3',
  'FEED_AFTER_POST_4',
  'FEED_AFTER_POST_6',
  'FEED_AFTER_POST_8',
  'FEED_AFTER_POST_10',
  'FEED_AFTER_POST_14',
  'FEED_INLINE',
  'DISCOVER_TOP',
  'DISCOVER_MIDDLE',
  'DISCOVER_BOTTOM',
  'MESSAGES_TOP',
  'PROFILE_TOP',
  'PROFILE_MIDDLE',
  'VOICE_ROOM_TOP',
  'VOICE_ROOM_BOTTOM',
  'GAME_CENTER_TOP',
  'GAME_CENTER_MIDDLE',
  'HOME_TOP',
  'HOME_MIDDLE',
  'HOME_BOTTOM',
] as const;

export type BannerPlacementKey =
  | (typeof BANNER_PLACEMENT_KEYS)[number]
  | (string & {});

export const BANNER_TAG_PRESETS = [
  'NEW',
  'HOT',
  'LIVE',
  'PROMOTION',
  'SPECIAL',
  'EVENT',
  'GAME',
  'HOTEL',
  'SPONSORED',
] as const;

export const SCREEN_LABELS: Record<string, string> = {
  HOME: 'Ana Sayfa',
  FEED: 'Feed',
  DISCOVER: 'Keşfet',
  MESSAGES: 'Mesajlar',
  PROFILE: 'Profil',
  VOICE_ROOM: 'Ses Odası',
  GAME_CENTER: 'Oyun Merkezi',
  SETTINGS: 'Ayarlar',
  MARKET: 'Market',
  LIVE: 'Canlı yayın',
};

export const PLACEMENT_LABELS: Record<string, string> = {
  FEED_TOP: 'Feed üst',
  FEED_AFTER_POST_3: 'Feed 3. içerik sonrası',
  FEED_AFTER_POST_4: 'Feed 4. içerik sonrası',
  FEED_AFTER_POST_6: 'Feed 6. içerik sonrası (otomatik oda)',
  FEED_AFTER_POST_8: 'Feed 8. içerik sonrası',
  FEED_AFTER_POST_10: 'Feed 10. içerik sonrası',
  FEED_AFTER_POST_14: 'Feed 14. içerik sonrası (otomatik canlı)',
  FEED_INLINE: 'Feed satır içi',
  DISCOVER_TOP: 'Keşfet üst',
  DISCOVER_MIDDLE: 'Keşfet orta',
  DISCOVER_BOTTOM: 'Keşfet alt',
  MESSAGES_TOP: 'Mesajlar üst',
  PROFILE_TOP: 'Profil üst',
  PROFILE_MIDDLE: 'Profil orta',
  VOICE_ROOM_TOP: 'Ses odası üst',
  VOICE_ROOM_BOTTOM: 'Ses odası alt',
  GAME_CENTER_TOP: 'Oyun merkezi üst',
  GAME_CENTER_MIDDLE: 'Oyun merkezi orta',
  HOME_TOP: 'Ana sayfa üst',
  HOME_MIDDLE: 'Ana sayfa orta',
  HOME_BOTTOM: 'Ana sayfa alt (otomatik oyun)',
};
