import type { BannerAction } from '../core/BannerTypes';
import { routeBannerAction } from '../actions/BannerActionRouter';
import { BannerTrackingService } from './BannerTrackingService';

export const BannerActionService = {
  async execute(input: {
    bannerId: string;
    action: BannerAction;
    placement?: string;
    screen?: string;
  }): Promise<{ ok: boolean; error?: string }> {
    void BannerTrackingService.trackClick({
      bannerId: input.bannerId,
      actionType: input.action.action_type,
      actionId: input.action.id,
      placement: input.placement,
      screen: input.screen,
    });

    return routeBannerAction(input.action, {
      bannerId: input.bannerId,
      placement: input.placement,
      screen: input.screen,
    });
  },
};
