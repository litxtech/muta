/**
 * Cascade adımlarını zamanlayıp SFX + görsel durum üretir.
 */

import {
  ANIM_DROP_MS,
  ANIM_MATCH_MS,
  ANIM_SPAWN_MS,
  ANIM_SWAP_MS,
} from '../sabitler/KristalSabitleri';
import type {
  CascadeEvent,
  CascadeStep,
  GridPos,
} from '../tipler/KristalTipleri';
import { playMatch3Sfx, type Match3SfxName } from '../ses/Match3Sesleri';
import { posKey } from '../motor/TahtaYardimcilari';

export type BoardFx = {
  clearing: Set<string>;
  spawning: Set<string>;
  shake: boolean;
  floatingScore: number | null;
};

export const BOS_FX: BoardFx = {
  clearing: new Set(),
  spawning: new Set(),
  shake: false,
  floatingScore: null,
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function matchSfx(groups: { length: number }[]): Match3SfxName {
  const maxLen = groups.reduce((m, g) => Math.max(m, g.length), 0);
  if (maxLen >= 5) return 'match_5';
  if (maxLen >= 4) return 'match_4';
  return 'match_3';
}

function specialSfx(special: string): Match3SfxName {
  if (special === 'bomb') return 'bomb';
  if (special === 'color_bomb') return 'color_bomb';
  if (special.startsWith('rocket')) return 'rocket';
  return 'bomb';
}

function keysOf(positions: GridPos[]): Set<string> {
  return new Set(positions.map(posKey));
}

export function eventDurationMs(event: CascadeEvent): number {
  switch (event.kind) {
    case 'swap':
      return ANIM_SWAP_MS;
    case 'match':
    case 'special_activated':
      return ANIM_MATCH_MS;
    case 'special_created':
      return Math.round(ANIM_SPAWN_MS * 0.7);
    case 'drop':
      return ANIM_DROP_MS;
    case 'fill':
      return ANIM_SPAWN_MS;
    case 'shuffle':
      return 360;
    case 'invalid_swap':
      return 280;
    default:
      return 160;
  }
}

export async function playCascadeSteps(opts: {
  steps: CascadeStep[];
  comboReached: number;
  onBoard: (board: CascadeStep['board']) => void;
  onFx: (fx: BoardFx) => void;
  signal?: { cancelled: boolean };
}): Promise<void> {
  const { steps, comboReached, onBoard, onFx, signal } = opts;
  let comboBlipPlayed = false;

  for (let i = 0; i < steps.length; i++) {
    if (signal?.cancelled) return;
    const { event, board } = steps[i];
    const fx: BoardFx = {
      clearing: new Set(),
      spawning: new Set(),
      shake: false,
      floatingScore: null,
    };

    switch (event.kind) {
      case 'swap':
        void playMatch3Sfx('tile_move');
        onFx(BOS_FX);
        onBoard(board);
        break;
      case 'match': {
        fx.clearing = keysOf(event.cleared);
        fx.floatingScore = event.scoreGain ?? null;
        onFx(fx);
        void playMatch3Sfx(matchSfx(event.groups));
        if (!comboBlipPlayed && comboReached >= 5) {
          void playMatch3Sfx('combo_big');
          comboBlipPlayed = true;
        } else if (!comboBlipPlayed && comboReached >= 2 && i > 0) {
          void playMatch3Sfx('combo');
          comboBlipPlayed = true;
        }
        break;
      }
      case 'special_activated': {
        fx.clearing = keysOf(event.cleared);
        fx.floatingScore = event.scoreGain ?? null;
        onFx(fx);
        void playMatch3Sfx(specialSfx(event.special));
        break;
      }
      case 'special_created':
        onBoard(board);
        fx.spawning = new Set([posKey(event.at)]);
        onFx(fx);
        break;
      case 'drop':
        void playMatch3Sfx('tile_move');
        onBoard(board);
        onFx(BOS_FX);
        break;
      case 'fill': {
        const spawn = new Set<string>();
        for (const row of board.cells) {
          for (const cell of row) {
            if (!cell.empty && cell.id.startsWith('fill-')) spawn.add(cell.id);
          }
        }
        onBoard(board);
        onFx({ ...BOS_FX, spawning: spawn });
        break;
      }
      case 'shuffle':
        void playMatch3Sfx('move_invalid');
        onBoard(board);
        onFx({ ...BOS_FX, shake: true });
        break;
      case 'invalid_swap':
        void playMatch3Sfx('move_invalid');
        onFx({ ...BOS_FX, shake: true });
        break;
      default:
        onFx(BOS_FX);
        onBoard(board);
    }

    await sleep(eventDurationMs(event));
    if (signal?.cancelled) return;
  }

  onFx(BOS_FX);
}
