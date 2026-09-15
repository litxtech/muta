import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BannerCampaign } from '../core/BannerTypes';
import { BANNER_CACHE_TTL_MS } from '../core/BannerConstants';

const CACHE_KEY = 'tamuso.banner.active.v1';

type CachePayload = {
  banners: BannerCampaign[];
  fetchedAt: number;
};

let memory: CachePayload | null = null;

export const BannerCacheService = {
  async get(): Promise<CachePayload | null> {
    if (memory && Date.now() - memory.fetchedAt < BANNER_CACHE_TTL_MS) {
      return memory;
    }
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (!raw) return memory;
      const parsed = JSON.parse(raw) as CachePayload;
      memory = parsed;
      return parsed;
    } catch {
      return memory;
    }
  },

  async set(banners: BannerCampaign[]): Promise<void> {
    const payload: CachePayload = { banners, fetchedAt: Date.now() };
    memory = payload;
    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  },

  invalidate(): void {
    memory = null;
    void AsyncStorage.removeItem(CACHE_KEY).catch(() => undefined);
  },

  isFresh(fetchedAt: number): boolean {
    return Date.now() - fetchedAt < BANNER_CACHE_TTL_MS;
  },

  /** Offline: expired banner'ları kesinlikle çıkar */
  filterNotExpired(banners: BannerCampaign[], now = new Date()): BannerCampaign[] {
    return banners.filter((b) => {
      if (b.status === 'EXPIRED' || b.status === 'ARCHIVED' || b.status === 'PAUSED') {
        return false;
      }
      if (b.end_at && new Date(b.end_at) < now) return false;
      return true;
    });
  },
};
