/**
 * NOX REELS — bonus altyapısı (ayrı modül; ana ekrana gömülmez).
 */

import type { SlotMathConfig } from '../tipler/SlotTipleri';
import { DEFAULT_MATH_CONFIG } from '../sabitler/SlotAyarlari';

export type BonusState = {
  active: boolean;
  spinsRemaining: number;
  payMultiplier: number;
};

export function createBonusState(
  awarded: number,
  config: SlotMathConfig = DEFAULT_MATH_CONFIG,
): BonusState {
  return {
    active: awarded > 0,
    spinsRemaining: awarded,
    payMultiplier: config.bonusPayMultiplier,
  };
}

export function shouldTriggerBonus(
  scatterCount: number,
  config: SlotMathConfig = DEFAULT_MATH_CONFIG,
): boolean {
  return scatterCount >= config.scatterTriggerCount;
}
