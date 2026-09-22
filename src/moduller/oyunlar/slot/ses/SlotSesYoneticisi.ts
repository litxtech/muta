/**
 * NOX REELS — kanal bazlı ses yöneticisi.
 * LiveKit ile uyumlu: keepAudioSessionActive.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, preload } from 'expo-audio';
import {
  SLOT_PRELOAD_SFX,
  SlotAudioCatalog,
  type SlotSfxName,
} from '../assets/SlotAudioAssets';
import { CHANNEL_VOLUMES } from '../sabitler/SlotAyarlari';

const STORAGE_KEY = 'tamuso.nox_reels.audio';

export type SlotAudioSettings = {
  effects: boolean;
  music: boolean;
};

export type { SlotSfxName };

type AudioPlayerLike = {
  volume: number;
  loop?: boolean;
  play: () => void;
  pause?: () => void;
  remove?: () => void;
  release?: () => void;
};

const DEFAULT: SlotAudioSettings = { effects: true, music: true };
let settings: SlotAudioSettings = { ...DEFAULT };
let settingsLoaded = false;
let voiceDuck = 1;
let sessionActive = false;
let generation = 0;
let musicPlayer: AudioPlayerLike | null = null;
let ambientPlayer: AudioPlayerLike | null = null;
const recent: AudioPlayerLike[] = [];
const lastAt = new Map<string, number>();
const COOLDOWN: Partial<Record<SlotSfxName, number>> = {
  reel_stop: 40,
  spin_start: 80,
  button_press: 60,
};

const PLAYER_OPTS = {
  keepAudioSessionActive: true,
  updateInterval: 60_000,
} as const;

const MAX_CONCURRENT = 8;

export async function loadSlotAudioSettings(): Promise<SlotAudioSettings> {
  if (settingsLoaded) return settings;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) settings = { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    settings = { ...DEFAULT };
  }
  settingsLoaded = true;
  return settings;
}

export async function saveSlotAudioSettings(
  patch: Partial<SlotAudioSettings>,
): Promise<SlotAudioSettings> {
  settings = { ...settings, ...patch };
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
  if (!settings.music) stopMusic();
  else if (sessionActive) void startSlotMusic();
  return settings;
}

export function setSlotVoiceDuck(active: boolean): void {
  voiceDuck = active ? 0.28 : 1;
  if (musicPlayer) musicPlayer.volume = CHANNEL_VOLUMES.MUSIC * voiceDuck;
  if (ambientPlayer) ambientPlayer.volume = CHANNEL_VOLUMES.AMBIENT * voiceDuck;
}

function channelVolume(ch: string): number {
  const base =
    ch === 'MUSIC'
      ? CHANNEL_VOLUMES.MUSIC
      : ch === 'AMBIENCE'
        ? CHANNEL_VOLUMES.AMBIENT
        : ch === 'WIN'
          ? CHANNEL_VOLUMES.WIN
          : ch === 'UI'
            ? CHANNEL_VOLUMES.UI
            : CHANNEL_VOLUMES.EFFECTS;
  return base * CHANNEL_VOLUMES.MASTER * voiceDuck;
}

function prunePlayers(): void {
  while (recent.length > MAX_CONCURRENT) {
    const p = recent.shift();
    try {
      p?.pause?.();
      p?.remove?.();
      p?.release?.();
    } catch {
      /* ignore */
    }
  }
}

export function playSlotSfx(name: SlotSfxName): void {
  if (!sessionActive || !settings.effects) return;
  const entry = SlotAudioCatalog[name];
  if (!entry?.source) return;
  if (entry.channel === 'MUSIC' || entry.channel === 'AMBIENCE') return;

  const now = Date.now();
  const cd = COOLDOWN[name] ?? 0;
  if (cd > 0 && now - (lastAt.get(name) ?? 0) < cd) return;
  lastAt.set(name, now);

  const gen = generation;
  try {
    const player = createAudioPlayer(entry.source, PLAYER_OPTS) as unknown as AudioPlayerLike;
    player.volume = channelVolume(entry.channel);
    player.play();
    recent.push(player);
    prunePlayers();
    setTimeout(() => {
      if (gen !== generation) return;
      try {
        player.pause?.();
        player.remove?.();
        player.release?.();
      } catch {
        /* ignore */
      }
      const i = recent.indexOf(player);
      if (i >= 0) recent.splice(i, 1);
    }, 6000);
  } catch {
    /* ses hatası oyunu kilitlemesin */
  }
}

function stopMusic(): void {
  try {
    musicPlayer?.pause?.();
    musicPlayer?.remove?.();
    musicPlayer?.release?.();
  } catch {
    /* ignore */
  }
  musicPlayer = null;
  try {
    ambientPlayer?.pause?.();
    ambientPlayer?.remove?.();
    ambientPlayer?.release?.();
  } catch {
    /* ignore */
  }
  ambientPlayer = null;
}

export async function startSlotMusic(): Promise<void> {
  if (!sessionActive || !settings.music) return;
  if (musicPlayer) return;
  try {
    musicPlayer = createAudioPlayer(
      SlotAudioCatalog.music.source,
      PLAYER_OPTS,
    ) as unknown as AudioPlayerLike;
    musicPlayer.loop = true;
    musicPlayer.volume = CHANNEL_VOLUMES.MUSIC * voiceDuck;
    musicPlayer.play();
  } catch {
    musicPlayer = null;
  }
  try {
    if (!ambientPlayer) {
      ambientPlayer = createAudioPlayer(
        SlotAudioCatalog.ambient.source,
        PLAYER_OPTS,
      ) as unknown as AudioPlayerLike;
      ambientPlayer.loop = true;
      ambientPlayer.volume = CHANNEL_VOLUMES.AMBIENT * voiceDuck;
      ambientPlayer.play();
    }
  } catch {
    ambientPlayer = null;
  }
}

export function beginSlotAudioSession(): void {
  sessionActive = true;
  generation += 1;
  void startSlotMusic();
}

export function stopAllSlotAudio(): void {
  sessionActive = false;
  generation += 1;
  stopMusic();
  for (const p of recent) {
    try {
      p.pause?.();
      p.remove?.();
      p.release?.();
    } catch {
      /* ignore */
    }
  }
  recent.length = 0;
}

let preloadPromise: Promise<void> | null = null;

export async function preloadSlotAudio(): Promise<void> {
  await loadSlotAudioSettings();
  if (!preloadPromise) {
    preloadPromise = Promise.all(
      SLOT_PRELOAD_SFX.map((n) => {
        const s = SlotAudioCatalog[n]?.source;
        return s == null ? Promise.resolve() : preload(s).then(() => undefined);
      }),
    )
      .then(() => undefined)
      .catch(() => undefined);
  }
  await Promise.race([
    preloadPromise,
    new Promise<void>((resolve) => setTimeout(resolve, 800)),
  ]);
}
