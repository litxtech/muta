/**
 * NOX REELS — client tarafı sonuç doğrulama (sunucu otoritesine karşı).
 * Uyumsuzlukta UI yine sunucu bakiyesini kullanır; yalnızca telemetri.
 */

import type { SlotSpinResult } from '../tipler/SlotTipleri';
import { DEFAULT_MATH_CONFIG } from '../sabitler/SlotAyarlari';
import { evaluateGrid } from './KazancHesaplayici';

export function validateServerResult(result: SlotSpinResult): {
  ok: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (!result.grid || result.grid.length !== 5) {
    reasons.push('grid_shape');
  }
  for (const col of result.grid ?? []) {
    if (!col || col.length !== 3) reasons.push('grid_rows');
  }
  if (result.betAmount <= 0) reasons.push('bet');
  if (result.winAmount < 0) reasons.push('win_negative');

  try {
    const local = evaluateGrid(
      result.grid,
      DEFAULT_MATH_CONFIG,
      result.betAmount,
      { isBonusSpin: result.isBonusSpin },
    );
    // Küçük yuvarlama toleransı
    if (Math.abs(local.winAmount - result.winAmount) > 1) {
      reasons.push('win_mismatch');
    }
  } catch {
    reasons.push('eval_error');
  }

  return { ok: reasons.length === 0, reasons };
}
