/**
 * Oyun kayıt defteri — plugin tarzı GameDefinition kaydı.
 */

import type { GameCode, GameDefinition } from '../ortak/tipler/OyunTipleri';
import { GameLogger } from './OyunLogger';

const registry = new Map<GameCode, GameDefinition>();

export function registerGame(definition: GameDefinition): void {
  if (registry.has(definition.code)) {
    GameLogger.warn('registerGame: kod zaten kayıtlı, üzerine yazılıyor', {
      code: definition.code,
    });
  }
  registry.set(definition.code, Object.freeze({ ...definition }));
  GameLogger.info('oyun kaydedildi', { code: definition.code, version: definition.version });
}

export function getGame(code: GameCode): GameDefinition | undefined {
  return registry.get(code);
}

export function listGames(): readonly GameDefinition[] {
  return Array.from(registry.values());
}

export function requireGame(code: GameCode): GameDefinition {
  const def = registry.get(code);
  if (!def) {
    throw new Error(`Oyun kayıtlı değil: ${String(code)}`);
  }
  return def;
}

export const OyunKayitSistemi = {
  registerGame,
  getGame,
  listGames,
  requireGame,
} as const;
