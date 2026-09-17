import { AnalyticsOlayEkle } from '../../guvenlik/analytics/AnalyticsOlayEkle';

const OLAYLAR = [
  'follow_clicked',
  'follow_success',
  'follow_failed',
  'unfollow',
  'follow_request_sent',
  'follow_request_accepted',
  'follow_request_rejected',
  'follower_removed',
  'followers_screen_opened',
  'following_screen_opened',
] as const;

export type TakipAnalitikOlayi = (typeof OLAYLAR)[number];

/** PII gonderme — sadece islem tipi. */
export function TakipAnalitik(olay: TakipAnalitikOlayi): void {
  void AnalyticsOlayEkle(olay, { source: 'follow' });
}
