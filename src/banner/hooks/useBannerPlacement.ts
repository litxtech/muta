import { useBanners } from './useBanners';
import { extractAfterPostIndex } from '../core/BannerPlacementEngine';

/** Placement hook — sayfa sadece placement key verir */
export function useBannerPlacement(placement: string) {
  return useBanners(placement);
}

/** Feed listesine after-post banner slotları için yardımcı */
export function useFeedBannerSlots(activePlacements: string[]) {
  const afterPosts = activePlacements
    .map(extractAfterPostIndex)
    .filter((n): n is number => n != null);
  return { afterPostIndexes: afterPosts };
}
