import {
  ALL_PAY_SYMBOLS,
  HIGH_SYMBOLS,
  LOW_SYMBOLS,
} from '../config/ZeusSabitleri';
import type { ZeusSymbolType } from '../tipler/ZeusTipleri';

export const EMPTY_INSTANCE_ID = '__empty__' as const;

export function emptyInstanceId(row: number, column: number): string {
  return `__empty_r${row}c${column}`;
}

export function isEmptyInstanceId(id: string): boolean {
  return id === EMPTY_INSTANCE_ID || id.startsWith('__empty_');
}

export function isPaySymbol(type: ZeusSymbolType): boolean {
  return (ALL_PAY_SYMBOLS as readonly string[]).includes(type);
}

export function isScatter(type: ZeusSymbolType): boolean {
  return type === 'zeusScatter';
}

export function isMultiplier(type: ZeusSymbolType): boolean {
  return type === 'multiplierOrb';
}

export function isHighValue(type: ZeusSymbolType): boolean {
  return (HIGH_SYMBOLS as readonly string[]).includes(type);
}

export function isLowValue(type: ZeusSymbolType): boolean {
  return (LOW_SYMBOLS as readonly string[]).includes(type);
}

export function participatesInMatch(type: ZeusSymbolType): boolean {
  return isPaySymbol(type);
}

/** Scatter ve çarpan tumble'da kalır — patlamaz. */
export function survivesTumble(type: ZeusSymbolType): boolean {
  return isScatter(type) || isMultiplier(type);
}
