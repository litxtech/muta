/**
 * NOX REELS — makara zamanlama yardımcıları.
 * Frame başına React state yok; Reanimated shared value ile kullanılır.
 */

import { ANIMATION_CONFIG } from '../sabitler/AnimasyonAyarlari';
import type { SlotAnimationConfig } from '../tipler/SlotTipleri';

export function reelStopDelayMs(
  reelIndex: number,
  config: SlotAnimationConfig = ANIMATION_CONFIG,
): number {
  const map = [
    config.stopOffsetsMs.reel0,
    config.stopOffsetsMs.reel1,
    config.stopOffsetsMs.reel2,
    config.stopOffsetsMs.reel3,
    config.stopOffsetsMs.reel4,
  ];
  return map[reelIndex] ?? reelIndex * 100;
}

export function totalSpinDurationMs(
  config: SlotAnimationConfig = ANIMATION_CONFIG,
): number {
  const lastOffset = Math.max(
    config.stopOffsetsMs.reel0,
    config.stopOffsetsMs.reel1,
    config.stopOffsetsMs.reel2,
    config.stopOffsetsMs.reel3,
    config.stopOffsetsMs.reel4,
  );
  return (
    config.spinAccelMs +
    config.spinCruiseMs +
    config.spinDecelMs +
    config.settleMs +
    lastOffset
  );
}

export function cruiseLoopsBeforeStop(reelIndex: number): number {
  return 8 + reelIndex * 2;
}
