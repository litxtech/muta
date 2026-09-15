import { useCallback, useRef } from 'react';
import {
  BANNER_IMPRESSION_MIN_MS,
  BANNER_IMPRESSION_VISIBLE_RATIO,
} from '../core/BannerConstants';
import { BannerTrackingService } from '../services/BannerTrackingService';
import type { BannerEventType } from '../core/BannerTypes';

/**
 * %50 görünürlük + min 500ms sonrası impression.
 */
export function useBannerTracking(input: {
  bannerId: string;
  sessionId: string;
  placement?: string;
  screen?: string;
}) {
  const visibleSince = useRef<number | null>(null);
  const impressed = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onVisibilityChange = useCallback(
    (ratio: number) => {
      if (impressed.current) return;

      if (ratio >= BANNER_IMPRESSION_VISIBLE_RATIO) {
        if (visibleSince.current == null) {
          visibleSince.current = Date.now();
        }
        if (!timer.current) {
          timer.current = setTimeout(() => {
            if (impressed.current) return;
            if (
              visibleSince.current &&
              Date.now() - visibleSince.current >= BANNER_IMPRESSION_MIN_MS
            ) {
              impressed.current = true;
              void BannerTrackingService.trackImpression({
                bannerId: input.bannerId,
                sessionId: input.sessionId,
                placement: input.placement,
                screen: input.screen,
              });
            }
          }, BANNER_IMPRESSION_MIN_MS);
        }
      } else {
        visibleSince.current = null;
        if (timer.current) {
          clearTimeout(timer.current);
          timer.current = null;
        }
      }
    },
    [input.bannerId, input.sessionId, input.placement, input.screen],
  );

  const trackEvent = useCallback(
    (eventType: BannerEventType, meta?: Record<string, unknown>) => {
      void BannerTrackingService.trackEvent({
        bannerId: input.bannerId,
        eventType,
        placement: input.placement,
        screen: input.screen,
        meta,
      });
    },
    [input.bannerId, input.placement, input.screen],
  );

  const trackClick = useCallback(
    (actionType?: string, actionId?: string) => {
      void BannerTrackingService.trackClick({
        bannerId: input.bannerId,
        actionType,
        actionId,
        placement: input.placement,
        screen: input.screen,
      });
    },
    [input.bannerId, input.placement, input.screen],
  );

  return { onVisibilityChange, trackEvent, trackClick };
}
