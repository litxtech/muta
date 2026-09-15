/**
 * Sembol tanımları — tek kaynak metadata.
 */

import {
  HIGH_SYMBOLS,
  LOW_SYMBOLS,
  SPECIAL_SYMBOLS,
  SYMBOL_COLORS,
  SYMBOL_LABELS,
  SYMBOL_SHAPES,
} from '../sabitler/KaskadSabitleri';
import type { KaskadSymbolType } from '../tipler/KaskadTipleri';

export type SymbolTier = 'low' | 'high' | 'special';

export type SymbolDefinition = {
  type: KaskadSymbolType;
  label: string;
  shape: string;
  color: string;
  tier: SymbolTier;
};

function tierOf(type: KaskadSymbolType): SymbolTier {
  if ((LOW_SYMBOLS as readonly string[]).includes(type)) return 'low';
  if ((HIGH_SYMBOLS as readonly string[]).includes(type)) return 'high';
  return 'special';
}

function define(type: KaskadSymbolType): SymbolDefinition {
  return {
    type,
    label: SYMBOL_LABELS[type],
    shape: SYMBOL_SHAPES[type],
    color: SYMBOL_COLORS[type],
    tier: tierOf(type),
  };
}

const ALL_TYPES: readonly KaskadSymbolType[] = [
  ...LOW_SYMBOLS,
  ...HIGH_SYMBOLS,
  ...SPECIAL_SYMBOLS,
];

export const SYMBOL_DEFINITIONS: Record<KaskadSymbolType, SymbolDefinition> =
  Object.fromEntries(ALL_TYPES.map((t) => [t, define(t)])) as Record<
    KaskadSymbolType,
    SymbolDefinition
  >;
