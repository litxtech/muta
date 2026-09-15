import type { BannerEventType } from '../core/BannerTypes';
import { BannerTrackingService } from '../services/BannerTrackingService';

export const BannerEventTypes = {
  IMPRESSION: 'impression',
  VIEW: 'view',
  CLICK: 'click',
  CTA_CLICK: 'cta_click',
  DISMISS: 'dismiss',
  VIDEO_START: 'video_start',
  VIDEO_COMPLETE: 'video_complete',
  WEBVIEW_OPEN: 'webview_open',
  CONVERSION: 'conversion',
} as const satisfies Record<string, BannerEventType>;

export const BannerAnalytics = {
  impression: (
    bannerId: string,
    opts?: { sessionId?: string; placement?: string; screen?: string },
  ) =>
    BannerTrackingService.trackImpression({
      bannerId,
      sessionId: opts?.sessionId ?? 'unknown',
      placement: opts?.placement,
      screen: opts?.screen,
    }),

  event: (
    bannerId: string,
    eventType: BannerEventType,
    opts?: { placement?: string; screen?: string; meta?: Record<string, unknown> },
  ) =>
    BannerTrackingService.trackEvent({
      bannerId,
      eventType,
      placement: opts?.placement,
      screen: opts?.screen,
      meta: opts?.meta,
    }),
};
