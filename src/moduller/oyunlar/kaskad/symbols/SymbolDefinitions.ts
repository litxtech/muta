/**
 * Sembol tanımları — tek kaynak metadata.
 */

import {
  SYMBOL_COLORS,
  SYMBOL_LABELS,
  SYMBOL_SHAPES,
} from '../sabitler/KaskadSabitleri';
import type { KaskadSymbolType } from '../tipler/KaskadTipleri';

export type SymbolDefinition = {
  type: KaskadSymbolType;
  label: string;
  shape: string;
  color: string;
  tier: 'low' | 'high' | 'special';
};

export const SYMBOL_DEFINITIONS: Record<KaskadSymbolType, SymbolDefinition> = {
  crystalBlue: {
    type: 'crystalBlue',
    label: SYMBOL_LABELS.crystalBlue,
    shape: SYMBOL_SHAPES.crystalBlue,
    color: SYMBOL_COLORS.crystalBlue,
    tier: 'low',
  },
  crystalViolet: {
    type: 'crystalViolet',
    label: SYMBOL_LABELS.crystalViolet,
    shape: SYMBOL_SHAPES.crystalViolet,
    color: SYMBOL_COLORS.crystalViolet,
    tier: 'low',
  },
  crystalMint: {
    type: 'crystalMint',
    label: SYMBOL_LABELS.crystalMint,
    shape: SYMBOL_SHAPES.crystalMint,
    color: SYMBOL_COLORS.crystalMint,
    tier: 'low',
  },
  crystalAmber: {
    type: 'crystalAmber',
    label: SYMBOL_LABELS.crystalAmber,
    shape: SYMBOL_SHAPES.crystalAmber,
    color: SYMBOL_COLORS.crystalAmber,
    tier: 'low',
  },
  starCore: {
    type: 'starCore',
    label: SYMBOL_LABELS.starCore,
    shape: SYMBOL_SHAPES.starCore,
    color: SYMBOL_COLORS.starCore,
    tier: 'high',
  },
  cosmicEye: {
    type: 'cosmicEye',
    label: SYMBOL_LABELS.cosmicEye,
    shape: SYMBOL_SHAPES.cosmicEye,
    color: SYMBOL_COLORS.cosmicEye,
    tier: 'high',
  },
  galaxyOrb: {
    type: 'galaxyOrb',
    label: SYMBOL_LABELS.galaxyOrb,
    shape: SYMBOL_SHAPES.galaxyOrb,
    color: SYMBOL_COLORS.galaxyOrb,
    tier: 'high',
  },
  energyCrown: {
    type: 'energyCrown',
    label: SYMBOL_LABELS.energyCrown,
    shape: SYMBOL_SHAPES.energyCrown,
    color: SYMBOL_COLORS.energyCrown,
    tier: 'high',
  },
  portalScatter: {
    type: 'portalScatter',
    label: SYMBOL_LABELS.portalScatter,
    shape: SYMBOL_SHAPES.portalScatter,
    color: SYMBOL_COLORS.portalScatter,
    tier: 'special',
  },
  multiplierOrb: {
    type: 'multiplierOrb',
    label: SYMBOL_LABELS.multiplierOrb,
    shape: SYMBOL_SHAPES.multiplierOrb,
    color: SYMBOL_COLORS.multiplierOrb,
    tier: 'special',
  },
};
