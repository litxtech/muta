/**
 * Kristal Savaşı sabitleri.
 */

import type { SpecialType, TileType } from '../tipler/KristalTipleri';
import { RenkTokenlari } from '../../../../tasarim-sistemi/RenkTokenlari';

export const GAME_VERSION = 'match3-v1.0.0' as const;
export const GAME_CODE = 'match3' as const;
export const GAME_DISPLAY_NAME = 'Tamuso Match' as const;

export const BOARD_SIZE = 8;

export const TILE_TYPES: readonly TileType[] = [
  'diamond',
  'star',
  'fire',
  'moon',
  'crown',
  'bolt',
  'crystal',
] as const;

export const TILE_LABELS: Record<TileType, string> = {
  diamond: 'Elmas',
  star: 'Yıldız',
  fire: 'Ateş',
  moon: 'Ay',
  crown: 'Taç',
  bolt: 'Şimşek',
  crystal: 'Kristal',
};

/** Şekil kodları — emoji değil, erişilebilir ayırt edici sembol */
export const TILE_SHAPE_CODES: Record<TileType, string> = {
  diamond: '◇',
  star: '✶',
  fire: '▲',
  moon: '☾',
  crown: '♛',
  bolt: '⚡',
  crystal: '◈',
};

export const TILE_COLORS: Record<TileType, string> = {
  diamond: RenkTokenlari.mint,
  star: RenkTokenlari.accent,
  fire: RenkTokenlari.danger,
  moon: RenkTokenlari.violet,
  crown: RenkTokenlari.primarySoft,
  bolt: RenkTokenlari.magenta,
  crystal: RenkTokenlari.primary,
};

export const SPECIAL_LABELS: Record<SpecialType, string> = {
  none: '',
  rocket_h: 'Roket Y',
  rocket_v: 'Roket D',
  bomb: 'Bomba',
  color_bomb: 'Renk',
};

export const SCORE_MATCH_3 = 100;
export const SCORE_MATCH_4 = 250;
export const SCORE_MATCH_5 = 500;
export const SCORE_ROCKET = 350;
export const SCORE_BOMB = 450;
export const SCORE_COLOR_BOMB = 800;

/** Cascade combo çarpanları (x1 taban) */
export const COMBO_MULTIPLIERS: ReadonlyArray<{ minCombo: number; mult: number }> = [
  { minCombo: 6, mult: 2.0 },
  { minCombo: 5, mult: 1.7 },
  { minCombo: 4, mult: 1.45 },
  { minCombo: 3, mult: 1.25 },
  { minCombo: 2, mult: 1.1 },
  { minCombo: 1, mult: 1.0 },
];

export const ANIM_SWAP_MS = 180;
export const ANIM_MATCH_MS = 240;
export const ANIM_DROP_MS = 200;
export const ANIM_SPAWN_MS = 200;

export const MAX_CASCADE_STEPS = 64;
export const BOARD_CREATE_MAX_ATTEMPTS = 80;

export const SFX_VOLUME = 0.45;
export const MUSIC_VOLUME = 0.3;
export const MUSIC_DUCK_VOLUME = 0.15;
