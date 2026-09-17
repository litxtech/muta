/**
 * Realm of Storms kaydı — GameRegistry plugin.
 */

import { registerGame } from '../cekirdek/OyunKayitSistemi';
import {
  GAME_CODE,
  GAME_DISPLAY_NAME,
  GAME_VERSION,
} from './sabitler/KaskadSabitleri';

let registered = false;

export function registerKozmikKaskad(): void {
  if (registered) return;
  registerGame({
    code: GAME_CODE,
    name: GAME_DISPLAY_NAME,
    description: '6×5 fırtına cascade — pay anywhere, çarpan, portal bonus',
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

registerKozmikKaskad();
