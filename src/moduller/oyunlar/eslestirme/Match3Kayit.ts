/**
 * Match-3 kaydı — GameRegistry'ye plugin olarak ekler.
 */

import { registerGame } from '../cekirdek/OyunKayitSistemi';
import {
  DEFAULT_DURATION_SECONDS,
  MAX_PLAYERS,
  MIN_PLAYERS,
} from '../ortak/sabitler/OyunSabitleri';
import {
  GAME_CODE,
  GAME_DISPLAY_NAME,
  GAME_VERSION,
} from './sabitler/KristalSabitleri';

let registered = false;

export function registerMatch3(): void {
  if (registered) return;
  registerGame({
    code: GAME_CODE,
    name: GAME_DISPLAY_NAME,
    description: 'Tamuso Match-3 sesli oda yarışı',
    minPlayers: MIN_PLAYERS,
    maxPlayers: MAX_PLAYERS,
    defaultDurationSeconds: DEFAULT_DURATION_SECONDS,
    economy: true,
    leaderboard: true,
    multiplayer: true,
    version: GAME_VERSION,
  });
  registered = true;
}

// Import yan etkisi — güvenli idempotent kayıt
registerMatch3();
