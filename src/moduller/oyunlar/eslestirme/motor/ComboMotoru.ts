/**
 * Combo seviyesi — cascade zinciri.
 */

import { COMBO_MULTIPLIERS } from '../sabitler/KristalSabitleri';

export function comboLevelFromCascade(cascadeIndex: number): number {
  return Math.max(1, Math.floor(cascadeIndex));
}

export function comboMultiplier(comboLevel: number): number {
  const level = Math.max(1, Math.floor(comboLevel));
  for (const row of COMBO_MULTIPLIERS) {
    if (level >= row.minCombo) return row.mult;
  }
  return 1;
}

export function comboLabel(comboLevel: number): string {
  if (comboLevel >= 16) return 'LEGENDARY';
  if (comboLevel >= 11) return 'EPIC';
  if (comboLevel >= 8) return 'AMAZING';
  if (comboLevel >= 5) return 'GREAT';
  if (comboLevel >= 3) return 'NICE';
  return 'COMBO';
}

export const ComboMotoru = {
  comboLevelFromCascade,
  comboMultiplier,
  comboLabel,
} as const;
