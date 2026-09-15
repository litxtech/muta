/**
 * Kozmik Kaskad ses yöneticisi — voice chat'i bastırmayan ducking.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { GameAssets, type KaskadSfxName } from '../assets/GameAssets';
import { MUSIC_DUCK_VOLUME, MUSIC_VOLUME, SFX_VOLUME } from '../sabitler/KaskadSabitleri';

const STORAGE_KEY = 'tamuso.kozmik_kaskad.audio';

export type KaskadAudioSettings = {
  sfx: boolean;
  music: boolean;
};

const DEFAULT: KaskadAudioSettings = { sfx: true, music: true };

let settings: KaskadAudioSettings = { ...DEFAULT };
let duckFactor = 1;
const recentPlayers: Array<{ remove?: () => void }> = [];
let musicPlayer: { volume: number; play: () => void; pause?: () => void; remove?: () => void } | null =
  null;

export async function loadKaskadAudioSettings(): Promise<KaskadAudioSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<KaskadAudioSettings>;
      settings = {
        sfx: parsed.sfx !== false,
        music: parsed.music !== false,
      };
    }
  } catch {
    settings = { ...DEFAULT };
  }
  return settings;
}

export async function saveKaskadAudioSettings(
  next: Partial<KaskadAudioSettings>,
): Promise<KaskadAudioSettings> {
  settings = { ...settings, ...next };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  return settings;
}

export function setKaskadVoiceDuck(active: boolean): void {
  duckFactor = active ? 0.75 : 1;
  if (musicPlayer) {
    musicPlayer.volume = (settings.music ? MUSIC_DUCK_VOLUME : 0) * duckFactor;
  }
}

async function createPlayer(source: number) {
  const audio = await import('expo-audio');
  const create =
    (
      audio as {
        createAudioPlayer?: (source: number) => {
          volume: number;
          play: () => void;
          pause?: () => void;
          remove?: () => void;
        };
      }
    ).createAudioPlayer ?? null;
  if (!create) return null;
  return create(source);
}

export async function playKaskadSfx(name: KaskadSfxName): Promise<void> {
  try {
    await loadKaskadAudioSettings();
    if (!settings.sfx) return;
    const asset = GameAssets.audio[name];
    if (asset == null) return;
    const player = await createPlayer(asset);
    if (!player) return;
    player.volume = SFX_VOLUME * duckFactor;
    player.play();
    recentPlayers.push(player);
    while (recentPlayers.length > 10) {
      const old = recentPlayers.shift();
      try {
        old?.remove?.();
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ses hatası oyunu durdurmaz */
  }
}

export async function startKaskadMusic(bonus = false): Promise<void> {
  try {
    await loadKaskadAudioSettings();
    stopKaskadMusic();
    if (!settings.music) return;
    const src = bonus
      ? GameAssets.audio.bonus_game_music
      : GameAssets.audio.normal_game_music;
    const player = await createPlayer(src);
    if (!player) return;
    player.volume = MUSIC_VOLUME * duckFactor;
    player.play();
    musicPlayer = player;
  } catch {
    /* ignore */
  }
}

export function stopKaskadMusic(): void {
  try {
    musicPlayer?.pause?.();
    musicPlayer?.remove?.();
  } catch {
    /* ignore */
  }
  musicPlayer = null;
}

export function getKaskadAudioSettings(): KaskadAudioSettings {
  return settings;
}
