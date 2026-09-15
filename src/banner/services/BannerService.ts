import { Platform } from 'react-native';
import { supabase } from '../../lib/supabase';
import type { BannerCampaign, BannerUserState } from '../core/BannerTypes';
import { BannerCacheService } from './BannerCacheService';

function normalizeCampaign(row: Record<string, unknown>): BannerCampaign {
  return {
    ...(row as unknown as BannerCampaign),
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    placements: Array.isArray(row.placements)
      ? (row.placements as BannerCampaign['placements'])
      : [],
    targets: Array.isArray(row.targets)
      ? (row.targets as BannerCampaign['targets'])
      : [],
    actions: Array.isArray(row.actions)
      ? (row.actions as BannerCampaign['actions'])
      : [],
    dismissible: Boolean(row.dismissible),
    shimmer_enabled: Boolean(row.shimmer_enabled),
    autoplay_video: row.autoplay_video !== false,
    loop_video: row.loop_video !== false,
    priority: Number(row.priority ?? 50),
  };
}

let realtimeBound = false;

export const BannerService = {
  async fetchActive(placement?: string): Promise<BannerCampaign[]> {
    const cached = await BannerCacheService.get();
    if (
      cached &&
      BannerCacheService.isFresh(cached.fetchedAt) &&
      !placement
    ) {
      return BannerCacheService.filterNotExpired(cached.banners);
    }

    try {
      const { data, error } = await supabase.rpc('banner_aktif_listele', {
        p_placement: placement ?? null,
      });
      if (error) throw error;
      const list = (Array.isArray(data) ? data : []).map((r) =>
        normalizeCampaign(r as Record<string, unknown>),
      );
      if (!placement) {
        await BannerCacheService.set(list);
      }
      return BannerCacheService.filterNotExpired(list);
    } catch {
      if (cached) {
        return BannerCacheService.filterNotExpired(cached.banners);
      }
      return [];
    }
  },

  async fetchUserStates(bannerIds: string[]): Promise<BannerUserState[]> {
    if (bannerIds.length === 0) return [];
    try {
      const { data, error } = await supabase.rpc('banner_user_state_getir', {
        p_banner_ids: bannerIds,
      });
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as BannerUserState[];
    } catch {
      return [];
    }
  },

  /** Tek realtime abonelik — tüm kampanya değişiklikleri */
  subscribeRealtime(onChange: () => void): () => void {
    if (realtimeBound) {
      return () => undefined;
    }
    realtimeBound = true;
    const channel = supabase
      .channel('banner_campaigns_rt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'banner_campaigns' },
        () => {
          BannerCacheService.invalidate();
          onChange();
        },
      )
      .subscribe();

    return () => {
      realtimeBound = false;
      void supabase.removeChannel(channel);
    };
  },

  currentPlatform(): 'IOS' | 'ANDROID' {
    return Platform.OS === 'ios' ? 'IOS' : 'ANDROID';
  },
};
