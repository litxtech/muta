import { registerGame } from '../cekirdek/OyunKayitSistemi';
import {
  GAME_CODE,
  GAME_DISPLAY_NAME,
  GAME_VERSION,
} from './sabitler/SlotAyarlari';

let registered = false;

export function registerNoxReels(): void {
  if (registered) return;
  registerGame({
    code: GAME_CODE,
    name: GAME_DISPLAY_NAME,
    description: '5×3 premium payline slot — wild, scatter, bonus',
    minPlayers: 1,
    maxPlayers: 1,
    defaultDurationSeconds: 0,
    economy: true,
    leaderboard: false,
    multiplayer: false,
    version: GAME_VERSION,
  });
  registered = true;
}

registerNoxReels();
