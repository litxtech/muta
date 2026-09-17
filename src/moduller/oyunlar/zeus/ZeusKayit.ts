import { registerGame } from '../cekirdek/OyunKayitSistemi';
import {
  GAME_CODE,
  GAME_DISPLAY_NAME,
  GAME_VERSION,
} from './config/ZeusSabitleri';

let registered = false;

export function registerZeus(): void {
  if (registered) return;
  registerGame({
    code: GAME_CODE,
    name: GAME_DISPLAY_NAME,
    description: '6×5 Olympus cascade — pay anywhere, çarpan, 4 Zeus = 15 ücretsiz tur',
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

registerZeus();
