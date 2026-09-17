/**
 * Olay tabanlı otomatik bannerlar — RPC + kampanya dönüşümü.
 */

import { supabase } from '../../lib/supabase';
import type { BannerActionType, BannerCampaign } from '../core/BannerTypes';
import { AUTO_ROOM_PROMO_PLACEMENTS } from '../core/BannerConstants';
import { RenkTokenlari } from '../../tasarim-sistemi/RenkTokenlari';
import type {
  AutoBannerAyarlari,
  AutoBannerKayit,
} from './AutoBannerTipleri';
import { AUTO_BANNER_AYAR_VARSAYILAN } from './AutoBannerTipleri';

const EVENT_PLACEMENTS = [
  { screen_key: 'FEED', placement_key: AUTO_ROOM_PROMO_PLACEMENTS.oda, sort_order: 0 },
  { screen_key: 'FEED', placement_key: AUTO_ROOM_PROMO_PLACEMENTS.canli, sort_order: 0 },
  { screen_key: 'HOME', placement_key: AUTO_ROOM_PROMO_PLACEMENTS.oyun, sort_order: 5 },
  { screen_key: 'HOME', placement_key: 'HOME_TOP', sort_order: 2 },
  { screen_key: 'DISCOVER', placement_key: 'DISCOVER_TOP', sort_order: 0 },
] as const;

const CHANNEL_NAME = 'auto_banners_live';

function httpsMedyaMi(url: string | null | undefined): string | null {
  const u = (url ?? '').trim();
  if (!u.startsWith('https://')) return null;
  try {
    const parsed = new URL(u);
    return parsed.hostname ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function autoBannerKampanyaya(
  row: AutoBannerKayit,
): BannerCampaign {
  const now = new Date().toISOString();
  const medya = httpsMedyaMi(row.media_url);
  const colors =
    row.gradient_json?.colors?.length === 2
      ? row.gradient_json.colors
      : [RenkTokenlari.deepPlum, RenkTokenlari.primary];

  return {
    id: `auto-event-${row.id}`,
    name: `auto_event_${row.kind}`,
    internal_name: row.source_key,
    title: row.title,
    subtitle: row.subtitle,
    description: null,
    badge: row.badge,
    label: null,
    media_type: medya ? 'IMAGE_TEXT' : 'GRADIENT',
    media_url: medya,
    thumbnail_url: null,
    media_alt: null,
    gradient_json: { colors },
    size_type: 'SMALL',
    aspect_ratio: '4:1',
    priority: 70,
    status: 'ACTIVE',
    start_at: row.created_at,
    end_at: row.expires_at,
    daily_start_time: null,
    daily_end_time: null,
    dismissible: true,
    frequency_type: '3_per_day',
    max_daily_impressions: 5,
    max_weekly_impressions: null,
    max_session_impressions: 2,
    shimmer_enabled: false,
    autoplay_video: false,
    loop_video: false,
    carousel_auto_slide_ms: 4500,
    tags: ['HOT', 'PROMOTION'],
    created_by: null,
    created_at: row.created_at,
    updated_at: now,
    placements: EVENT_PLACEMENTS.map((p) => ({ ...p })),
    targets: [],
    actions: [
      {
        slot: 0,
        action_type: row.action_type as BannerActionType,
        button_text:
          row.kind === 'live_coins'
            ? 'İzle'
            : row.kind === 'game_coins'
              ? 'Git'
              : 'Katıl',
        target: row.action_target,
      },
    ],
  };
}

let cache: { at: number; banners: BannerCampaign[] } | null = null;
const CACHE_MS = 20_000;

export async function OlayBannerlariGetir(): Promise<BannerCampaign[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.banners;

  const { data, error } = await supabase.rpc('auto_banner_aktif_listele');
  if (error) {
    console.warn('[auto-banner]', error.message);
    return cache?.banners ?? [];
  }

  const rows = (data ?? []) as AutoBannerKayit[];
  const banners = rows.map(autoBannerKampanyaya);
  cache = { at: Date.now(), banners };
  return banners;
}

export function OlayBannerCacheTemizle(): void {
  cache = null;
}

type OlayDinleyiciDurum = {
  kanal: ReturnType<typeof supabase.channel>;
  dinleyiciler: Set<() => void>;
};

let olayRealtime: OlayDinleyiciDurum | null = null;
/** Kurulum sırasında paralel useBanners çağrılarını tek kanala bağla */
let olayRealtimeHazirlik: Promise<OlayDinleyiciDurum> | null = null;

async function mevcutKanallariTemizle(): Promise<void> {
  const mevcut = supabase.getChannels().filter((ch) => {
    const t = ch.topic ?? '';
    return (
      t === CHANNEL_NAME ||
      t === `realtime:${CHANNEL_NAME}` ||
      t.endsWith(`:${CHANNEL_NAME}`)
    );
  });
  await Promise.all(mevcut.map((ch) => supabase.removeChannel(ch)));
}

async function olayRealtimeKur(): Promise<OlayDinleyiciDurum> {
  if (olayRealtime) return olayRealtime;
  if (olayRealtimeHazirlik) return olayRealtimeHazirlik;

  olayRealtimeHazirlik = (async () => {
    try {
      await mevcutKanallariTemizle();

      const dinleyiciler = new Set<() => void>();
      // Benzersiz ad: hot reload / eski subscribed kanal `.on` hatasını önler
      const kanal = supabase.channel(
        `${CHANNEL_NAME}_${Date.now().toString(36)}`,
      );
      kanal.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'auto_banners' },
        () => {
          OlayBannerCacheTemizle();
          for (const fn of dinleyiciler) {
            try {
              fn();
            } catch {
              /* ignore */
            }
          }
        },
      );
      kanal.subscribe();

      const durum: OlayDinleyiciDurum = { kanal, dinleyiciler };
      olayRealtime = durum;
      return durum;
    } catch (e) {
      // Kanal kurulamazsa boş set ile devam — UI çökmesin
      console.warn('[auto-banner] realtime kurulamadı', e);
      const durum: OlayDinleyiciDurum = {
        kanal: supabase.channel(`${CHANNEL_NAME}_noop_${Date.now()}`),
        dinleyiciler: new Set(),
      };
      olayRealtime = durum;
      return durum;
    } finally {
      olayRealtimeHazirlik = null;
    }
  })();

  return olayRealtimeHazirlik;
}

/**
 * Tek kanal, çoklu dinleyici.
 * Home + Profile birden fazla useBanners aynı anda abone olur — yarış yok.
 */
export function OlayBannerRealtimeDinle(onChange: () => void): () => void {
  let iptal = false;

  void olayRealtimeKur().then((durum) => {
    if (iptal) return;
    durum.dinleyiciler.add(onChange);
  });

  return () => {
    iptal = true;
    if (!olayRealtime) return;
    olayRealtime.dinleyiciler.delete(onChange);
    if (olayRealtime.dinleyiciler.size === 0) {
      const { kanal } = olayRealtime;
      olayRealtime = null;
      void supabase.removeChannel(kanal);
    }
  };
}

export async function AutoBannerAyarlariGetir(): Promise<AutoBannerAyarlari> {
  const { data, error } = await supabase.rpc('auto_banner_ayarlari_getir');
  if (error) throw new Error(error.message);
  return {
    ...AUTO_BANNER_AYAR_VARSAYILAN,
    ...(data as Partial<AutoBannerAyarlari>),
  };
}

export async function AdminAutoBannerAyarlariKaydet(
  ayarlar: Partial<AutoBannerAyarlari>,
): Promise<AutoBannerAyarlari> {
  const { data, error } = await supabase.rpc('admin_auto_banner_ayarlari_kaydet', {
    p_ayarlar: ayarlar,
  });
  if (error) throw new Error(error.message);
  OlayBannerCacheTemizle();
  return {
    ...AUTO_BANNER_AYAR_VARSAYILAN,
    ...(data as Partial<AutoBannerAyarlari>),
  };
}

export async function AdminAutoBannerListele(): Promise<AutoBannerKayit[]> {
  const { data, error } = await supabase.rpc('admin_auto_banner_listele');
  if (error) throw new Error(error.message);
  return (data ?? []) as AutoBannerKayit[];
}

export async function AdminAutoBannerKapat(id: string): Promise<void> {
  const { error } = await supabase.rpc('admin_auto_banner_kapat', { p_id: id });
  if (error) throw new Error(error.message);
  OlayBannerCacheTemizle();
}
