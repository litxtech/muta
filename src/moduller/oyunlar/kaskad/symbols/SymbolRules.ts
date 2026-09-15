/**
 * Sembol kuralları — hangileri ödeme verir, özel midir.
 */

import {
  ALL_PAY_SYMBOLS,
  HIGH_SYMBOLS,
  LOW_SYMBOLS,
} from '../sabitler/KaskadSabitleri';
import type { KaskadSymbolType } from '../tipler/KaskadTipleri';

/** Boş hücre placeholder'ı — grid compaction sırasında kullanılır */
export const EMPTY_INSTANCE_ID = '__empty__' as const;

export function isPaySymbol(type: KaskadSymbolType): boolean {
  return (ALL_PAY_SYMBOLS as readonly string[]).includes(type);
}

export function isScatter(type: KaskadSymbolType): boolean {
  return type === 'portalScatter';
}

export function isMultiplier(type: KaskadSymbolType): boolean {
  return type === 'stormMultiplier';
}

export function isHighValue(type: KaskadSymbolType): boolean {
  return (HIGH_SYMBOLS as readonly string[]).includes(type);
}

export function isLowValue(type: KaskadSymbolType): boolean {
  return (LOW_SYMBOLS as readonly string[]).includes(type);
}

/** Scatter / multiplier cluster ödemesine dahil değil */
export function participatesInMatch(type: KaskadSymbolType): boolean {
  return isPaySymbol(type);
}
