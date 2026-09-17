/**
 * NOX REELS — kazanım sunum zamanlaması.
 */

import { ANIMATION_CONFIG } from '../sabitler/AnimasyonAyarlari';
import type { SlotWinTier } from '../tipler/SlotTipleri';

export function winPresentationMs(
  lineCount: number,
  tier: SlotWinTier,
): number {
  const lines = Math.max(1, lineCount) * ANIMATION_CONFIG.lineShowMs;
  if (tier === 'EPIC_WIN') return lines + ANIMATION_CONFIG.bigWinCountMs + 800;
  if (tier === 'MEGA_WIN') return lines + ANIMATION_CONFIG.bigWinCountMs + 400;
  if (tier === 'BIG_WIN') return lines + ANIMATION_CONFIG.bigWinCountMs;
  return lines + ANIMATION_CONFIG.winPulseMs;
}
