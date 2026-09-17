import { supabase } from '../../lib/supabase';
import { AnalyticsOlayEkle } from '../../moduller/guvenlik/analytics/AnalyticsOlayEkle';
import type { BannerEventType } from '../core/BannerTypes';

const impressed = new Set<string>();

function impressionKey(
  bannerId: string,
  sessionId: string,
  placement: string,
): string {
  return `${bannerId}:${sessionId}:${placement}`;
}

export const BannerTrackingService = {
  isSyntheticBannerId(bannerId: string): boolean {
    return (
      bannerId.startsWith('auto-room-') ||
      bannerId.startsWith('promo-') ||
      bannerId.startsWith('auto-event-')
    );
  },

  async trackImpression(input: {
    bannerId: string;
    sessionId: string;
    screen?: string;
    placement?: string;
  }): Promise<void> {
    if (BannerTrackingService.isSyntheticBannerId(input.bannerId)) {
      void AnalyticsOlayEkle('banner_impression', {
        banner_id: input.bannerId,
        placement: input.placement,
        screen: input.screen,
        synthetic: true,
      });
      return;
    }
    const key = impressionKey(
      input.bannerId,
      input.sessionId,
      input.placement ?? '',
    );
    if (impressed.has(key)) return;
    impressed.add(key);

    try {
      await supabase.rpc('banner_impression_kaydet', {
        p_banner_id: input.bannerId,
        p_session_id: input.sessionId,
        p_screen: input.screen ?? null,
        p_placement: input.placement ?? null,
      });
      void AnalyticsOlayEkle('banner_impression', {
        banner_id: input.bannerId,
        placement: input.placement,
        screen: input.screen,
      });
    } catch {
      impressed.delete(key);
    }
  },

  async trackClick(input: {
    bannerId: string;
    actionType?: string | null;
    actionId?: string | null;
    placement?: string;
    screen?: string;
  }): Promise<void> {
    if (BannerTrackingService.isSyntheticBannerId(input.bannerId)) {
      void AnalyticsOlayEkle('banner_click', {
        banner_id: input.bannerId,
        action_type: input.actionType,
        placement: input.placement,
        synthetic: true,
      });
      return;
    }
    try {
      await supabase.rpc('banner_click_kaydet', {
        p_banner_id: input.bannerId,
        p_action_type: input.actionType ?? null,
        p_action_id: input.actionId ?? null,
        p_placement: input.placement ?? null,
        p_screen: input.screen ?? null,
      });
      void AnalyticsOlayEkle('banner_click', {
        banner_id: input.bannerId,
        action_type: input.actionType,
        placement: input.placement,
      });
    } catch {
      /* ignore */
    }
  },

  async trackEvent(input: {
    bannerId: string;
    eventType: BannerEventType;
    placement?: string;
    screen?: string;
    meta?: Record<string, unknown>;
  }): Promise<void> {
    if (BannerTrackingService.isSyntheticBannerId(input.bannerId)) return;
    try {
      await supabase.rpc('banner_event_kaydet', {
        p_banner_id: input.bannerId,
        p_event_type: input.eventType,
        p_placement: input.placement ?? null,
        p_screen: input.screen ?? null,
        p_meta: input.meta ?? {},
      });
    } catch {
      /* ignore */
    }
  },

  clearSessionImpressions(): void {
    impressed.clear();
  },
};
