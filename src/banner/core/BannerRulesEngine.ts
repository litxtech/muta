import type { BannerCampaign, BannerUserContext } from './BannerTypes';
import { filterBannersForPlacement } from './BannerPlacementEngine';
import type { BannerUserState } from './BannerTypes';
import { isBannerEligible } from './BannerEligibilityEngine';

export type BannerEngineSnapshot = {
  banners: BannerCampaign[];
  userStates: Map<string, BannerUserState>;
  fetchedAt: number;
};

/**
 * Merkezi banner motoru — fetch/cache dışı saf karar katmanı.
 */
export const BannerEngine = {
  forPlacement(
    snapshot: BannerEngineSnapshot,
    placement: string,
    ctx: BannerUserContext,
  ): BannerCampaign[] {
    return filterBannersForPlacement(
      snapshot.banners,
      placement,
      ctx,
      snapshot.userStates,
    );
  },

  debugEligibility(
    banner: BannerCampaign,
    ctx: BannerUserContext,
    state?: BannerUserState,
    placement?: string,
  ) {
    return isBannerEligible(banner, ctx, state, placement);
  },
};
