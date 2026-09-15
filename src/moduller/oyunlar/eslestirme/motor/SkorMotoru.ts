/**
 * Skor motoru — eşleşme boyutu + özel taş + combo çarpanı.
 */

import type { MatchGroup, SpecialType } from '../tipler/KristalTipleri';
import {
  SCORE_BOMB,
  SCORE_COLOR_BOMB,
  SCORE_MATCH_3,
  SCORE_MATCH_4,
  SCORE_MATCH_5,
  SCORE_ROCKET,
} from '../sabitler/KristalSabitleri';
import { comboMultiplier } from './ComboMotoru';

export function baseScoreForMatchLength(length: number): number {
  if (length >= 5) return SCORE_MATCH_5;
  if (length >= 4) return SCORE_MATCH_4;
  if (length >= 3) return SCORE_MATCH_3;
  return 0;
}

export function scoreForSpecial(special: SpecialType): number {
  switch (special) {
    case 'rocket_h':
    case 'rocket_v':
      return SCORE_ROCKET;
    case 'bomb':
      return SCORE_BOMB;
    case 'color_bomb':
      return SCORE_COLOR_BOMB;
    default:
      return 0;
  }
}

export function scoreMatchGroups(
  groups: MatchGroup[],
  comboLevel: number,
): number {
  const mult = comboMultiplier(comboLevel);
  let total = 0;
  for (const g of groups) {
    total += Math.floor(baseScoreForMatchLength(g.length) * mult);
  }
  return total;
}

export function scoreClearedSpecials(
  specials: SpecialType[],
  comboLevel: number,
): number {
  const mult = comboMultiplier(comboLevel);
  let total = 0;
  for (const s of specials) {
    total += Math.floor(scoreForSpecial(s) * mult);
  }
  return total;
}

export const SkorMotoru = {
  baseScoreForMatchLength,
  scoreForSpecial,
  scoreMatchGroups,
  scoreClearedSpecials,
} as const;
