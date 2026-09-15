import { router } from 'expo-router';
import { BannerTrackingService } from '../services/BannerTrackingService';

export type ActionContext = {
  bannerId: string;
  placement?: string;
  screen?: string;
};

export async function openInAppWebView(
  url: string,
  title?: string,
  ctx?: ActionContext,
): Promise<void> {
  if (ctx) {
    void BannerTrackingService.trackEvent({
      bannerId: ctx.bannerId,
      eventType: 'webview_open',
      placement: ctx.placement,
      screen: ctx.screen,
      meta: { url },
    });
  }
  router.push({
    pathname: '/webview',
    params: { url, title: title ?? 'Tamuso' },
  } as never);
}
