/**
 * Match-3 SFX — expo-audio; volume 0.45 (oda sesini bastırmasın).
 */

import { SFX_VOLUME } from '../sabitler/KristalSabitleri';
import { loadMatch3SesAyarlari } from './Match3SesAyarlari';

export type Match3SfxName =
  | 'tile_move'
  | 'move_invalid'
  | 'match_3'
  | 'match_4'
  | 'match_5'
  | 'rocket'
  | 'bomb'
  | 'color_bomb'
  | 'combo'
  | 'combo_big'
  | 'countdown'
  | 'game_start'
  | 'game_end'
  | 'win'
  | 'leader_change';

const ASSET_MAP: Record<Match3SfxName, number> = {
  tile_move: require('../../../../../assets/sounds/oyun/tile_move.wav'),
  move_invalid: require('../../../../../assets/sounds/oyun/move_invalid.wav'),
  match_3: require('../../../../../assets/sounds/oyun/match_3.wav'),
  match_4: require('../../../../../assets/sounds/oyun/match_4.wav'),
  match_5: require('../../../../../assets/sounds/oyun/match_5.wav'),
  rocket: require('../../../../../assets/sounds/oyun/rocket.wav'),
  bomb: require('../../../../../assets/sounds/oyun/bomb.wav'),
  color_bomb: require('../../../../../assets/sounds/oyun/color_bomb.wav'),
  combo: require('../../../../../assets/sounds/oyun/combo.wav'),
  combo_big: require('../../../../../assets/sounds/oyun/combo_big.wav'),
  countdown: require('../../../../../assets/sounds/oyun/countdown.wav'),
  game_start: require('../../../../../assets/sounds/oyun/game_start.wav'),
  game_end: require('../../../../../assets/sounds/oyun/game_end.wav'),
  win: require('../../../../../assets/sounds/oyun/win.wav'),
  leader_change: require('../../../../../assets/sounds/oyun/leader_change.wav'),
};

let duckFactor = 1;
const recentPlayers: Array<{ remove?: () => void }> = [];

export function setMatch3MusicDuck(active: boolean): void {
  duckFactor = active ? 0.85 : 1;
}

export async function playMatch3Sfx(name: Match3SfxName): Promise<void> {
  try {
    const ayar = await loadMatch3SesAyarlari();
    if (!ayar.sfx) return;

    const asset = ASSET_MAP[name];
    if (asset == null) return;

    const audio = await import('expo-audio');
    const createPlayer =
      (
        audio as {
          createAudioPlayer?: (source: number) => {
            volume: number;
            play: () => void;
            remove?: () => void;
          };
        }
      ).createAudioPlayer ?? null;

    if (!createPlayer) return;

    const player = createPlayer(asset);
    player.volume = SFX_VOLUME * duckFactor;
    player.play();
    recentPlayers.push(player);
    while (recentPlayers.length > 8) {
      const old = recentPlayers.shift();
      try {
        old?.remove?.();
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* asla throw etme */
  }
}

export const Match3Sesleri = {
  play: playMatch3Sfx,
  setMusicDuck: setMatch3MusicDuck,
} as const;
