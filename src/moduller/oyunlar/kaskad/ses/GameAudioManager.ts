/**
 * GameAudioManager — kanal bazlı ses mimarisi.
 * Kanallar: MUSIC / AMBIENCE / SFX / UI / WIN / CHARACTER (ayrı volume).
 * Admin playlist aktifken builtin BGM/ambience kapanır; parçalar süre bitince sıradaki çalar.
 * TAMUSO KURALI: Voice chat HER ZAMAN önceliklidir — voice aktifken tüm
 * kanallar duck edilir, müzik ekstra kısılır. Asset yoksa sessizce atlanır.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, preload } from 'expo-audio';
import {
  GameAudio,
  type AudioChannel,
  type KaskadSfxName,
} from '../assets/GameAssets';
import {
  CHANNEL_VOLUMES,
  MUSIC_DUCK_VOLUME,
  VOICE_DUCK_FACTOR,
} from '../sabitler/KaskadSabitleri';
import type { GameEventName, GameEventPayload } from '../animasyonlar/AnimationDirector';

const STORAGE_KEY = 'tamuso.kozmik_kaskad.audio';

export type KaskadAudioSettings = {
  sfx: boolean;
  music: boolean;
};

export type KaskadMusicTrack = {
  id: string;
  title: string;
  publicUrl: string;
  mimeType?: string | null;
  fileExt?: string | null;
  durationMs?: number | null;
  sortOrder: number;
  aktif?: boolean;
};

export type KaskadMusicCatalog = {
  mode: 'builtin' | 'playlist';
  loop: boolean;
  tracks: KaskadMusicTrack[];
};

type AudioPlayer = {
  volume: number;
  loop?: boolean;
  play: () => void;
  pause?: () => void;
  remove?: () => void;
  release?: () => void;
};

type AudioPlaylist = {
  volume: number;
  loop?: string;
  play: () => void;
  pause?: () => void;
  destroy?: () => void;
};

type CreateAudioPlaylistFn = (options?: {
  sources?: Array<string | { uri: string; name?: string }>;
  loop?: 'none' | 'single' | 'all';
  updateInterval?: number;
}) => AudioPlaylist;

let ambiencePlayer: AudioPlayer | null = null;
let playlistPlayer: AudioPlaylist | null = null;
let musicCatalog: KaskadMusicCatalog | null = null;
/** URI playlist sıradaki parça zamanlayıcısı — çıkışta temizlenmeli */
let playlistAdvanceTimer: ReturnType<typeof setTimeout> | null = null;

const DEFAULT: KaskadAudioSettings = { sfx: true, music: true };

let settings: KaskadAudioSettings = { ...DEFAULT };
let settingsLoaded = false;
let duckFactor = 1;
const recentPlayers: AudioPlayer[] = [];
let musicPlayer: AudioPlayer | null = null;
let musicIsBonus = false;
let countUpPlayer: AudioPlayer | null = null;
let countUpToken = 0;
/** stopAll sonrası tamamlanan async createPlayer'ların yeniden çalmasını engeller */
let audioGeneration = 0;
/** false iken müzik/SFX başlamaz (çıkış sonrası event race) */
let audioSessionActive = false;
const MAX_CONCURRENT = 10;
const ONE_SHOT_RELEASE_MS = 8_000;
const lastSfxAt = new Map<KaskadSfxName, number>();
const SFX_COOLDOWN_MS: Partial<Record<KaskadSfxName, number>> = {
  symbols_falling: 90,
  symbol_land: 55,
  cascade_land: 55,
  symbol_match: 70,
  symbol_destroy: 70,
  lightning: 120,
};

let audioPreload: Promise<void> | null = null;

/** Sık kullanılan yerel sesleri ilk etkileşimden önce native önbelleğe alır. */
export function preloadKaskadAudio(): Promise<void> {
  if (!audioPreload) {
    const names: KaskadSfxName[] = [
      'spin_press',
      'symbols_falling',
      'symbol_land',
      'symbol_match',
      'symbol_destroy',
      'cascade_start',
      'multiplier_spawn',
      'multiplier_collect',
      'lightning',
      'normal_win',
      'count_up',
      'count_up_end',
    ];
    audioPreload = Promise.all(
      names.map((name) => {
        const source = GameAudio[name]?.source;
        return source == null ? Promise.resolve() : preload(source).then(() => undefined);
      }),
    )
      .then(() => undefined)
      .catch(() => undefined);
  }
  return audioPreload;
}

function clearPlaylistAdvanceTimer(): void {
  if (playlistAdvanceTimer != null) {
    clearTimeout(playlistAdvanceTimer);
    playlistAdvanceTimer = null;
  }
}

/**
 * LiveKit voice oturumu ile paylaşım:
 * keepAudioSessionActive:false (varsayılan) → player pause/remove AVAudioSession'ı
 * deaktive eder → ses odası ve bazen UI donar. SFX için status poll da gereksiz.
 */
const PLAYER_OPTS = {
  keepAudioSessionActive: true,
  updateInterval: 60_000,
} as const;

export async function loadKaskadAudioSettings(): Promise<KaskadAudioSettings> {
  if (settingsLoaded) return settings;
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
  settingsLoaded = true;
  return settings;
}

export async function saveKaskadAudioSettings(
  next: Partial<KaskadAudioSettings>,
): Promise<KaskadAudioSettings> {
  settings = { ...settings, ...next };
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* depolama hatası sesi durdurmaz */
  }
  return settings;
}

export function getKaskadAudioSettings(): KaskadAudioSettings {
  return settings;
}

/** Oyun açılışında admin müzik kataloğunu bağla */
export function setKaskadMusicCatalog(catalog: KaskadMusicCatalog | null): void {
  musicCatalog = catalog;
}

export function getKaskadMusicCatalog(): KaskadMusicCatalog | null {
  return musicCatalog;
}

function playlistAktif(): boolean {
  return (
    musicCatalog?.mode === 'playlist' &&
    (musicCatalog.tracks?.filter((t) => t.aktif !== false && !!t.publicUrl)
      ?.length ?? 0) > 0
  );
}

/** Oyun ekranı açılınca çağır — stopAll sonrası yeniden çalmayı açar */
export function beginKaskadAudioSession(): void {
  audioSessionActive = true;
  audioGeneration += 1;
}

/** Voice chat aktifken ducking — voice room konuşması asla bastırılmaz */
export function setKaskadVoiceDuck(active: boolean): void {
  duckFactor = active ? VOICE_DUCK_FACTOR : 1;
  const vol =
    (settings.music ? MUSIC_DUCK_VOLUME : 0) * (active ? duckFactor : 1);
  if (musicPlayer) musicPlayer.volume = vol;
  if (playlistPlayer) playlistPlayer.volume = vol;
}

function channelVolume(channel: AudioChannel): number {
  return CHANNEL_VOLUMES[channel] * duckFactor;
}

async function createPlayer(
  source: number | string | { uri: string; name?: string },
): Promise<AudioPlayer | null> {
  try {
    return createAudioPlayer(source, PLAYER_OPTS) as unknown as AudioPlayer;
  } catch {
    return null;
  }
}

function releasePlayer(player: AudioPlayer | null | undefined): void {
  if (!player) return;
  try {
    player.volume = 0;
  } catch {
    /* ignore */
  }
  try {
    player.pause?.();
  } catch {
    /* ignore */
  }
  try {
    player.remove?.();
  } catch {
    /* ignore */
  }
  try {
    player.release?.();
  } catch {
    /* ignore */
  }
}

function releasePlaylist(player: AudioPlaylist | null | undefined): void {
  if (!player) return;
  try {
    player.volume = 0;
  } catch {
    /* ignore */
  }
  try {
    player.pause?.();
  } catch {
    /* ignore */
  }
  try {
    player.destroy?.();
  } catch {
    /* ignore */
  }
}

export async function playKaskadSfx(name: KaskadSfxName): Promise<void> {
  if (!audioSessionActive) return;
  const now = Date.now();
  const cooldown = SFX_COOLDOWN_MS[name] ?? 0;
  if (now - (lastSfxAt.get(name) ?? 0) < cooldown) return;
  lastSfxAt.set(name, now);
  const gen = audioGeneration;
  try {
    await loadKaskadAudioSettings();
    if (!audioSessionActive || gen !== audioGeneration) return;
    if (!settings.sfx) return;
    const entry = GameAudio[name];
    if (!entry || entry.source == null) return; // eksik asset → crash yok
    const player = await createPlayer(entry.source);
    if (!player) return;
    if (!audioSessionActive || gen !== audioGeneration) {
      releasePlayer(player);
      return;
    }
    player.volume = channelVolume(entry.channel);
    player.play();
    recentPlayers.push(player);
    setTimeout(() => {
      const index = recentPlayers.indexOf(player);
      if (index >= 0) recentPlayers.splice(index, 1);
      releasePlayer(player);
    }, ONE_SHOT_RELEASE_MS);
    while (recentPlayers.length > MAX_CONCURRENT) {
      releasePlayer(recentPlayers.shift());
    }
  } catch {
    /* ses hatası oyunu durdurmaz */
  }
}

async function startPlaylistMusic(gen: number): Promise<void> {
  if (!musicCatalog || !playlistAktif()) return;
  const tracks = musicCatalog.tracks.filter((t) => t.aktif !== false && !!t.publicUrl);
  if (tracks.length === 0) return;

  clearPlaylistAdvanceTimer();
  stopBuiltinMusicOnly();
  releasePlaylist(playlistPlayer);
  playlistPlayer = null;

  try {
    const audio = await import('expo-audio');
    const createPl = (audio as { createAudioPlaylist?: CreateAudioPlaylistFn })
      .createAudioPlaylist;
    // createAudioPlaylist varsa kullan; yoksa süre bazlı URI zinciri
    if (createPl && tracks.every((t) => !t.durationMs || t.durationMs <= 0)) {
      if (!audioSessionActive || gen !== audioGeneration) return;
      const pl = createPl({
        sources: tracks.map((t) => ({ uri: t.publicUrl, name: t.title })),
        loop: musicCatalog.loop ? 'all' : 'none',
        updateInterval: 1000,
      });
      if (!audioSessionActive || gen !== audioGeneration) {
        releasePlaylist(pl);
        return;
      }
      pl.volume = channelVolume('MUSIC');
      pl.play();
      playlistPlayer = pl;
      return;
    }
    await startUriDurationPlaylist(tracks, gen, 0);
  } catch {
    try {
      await startUriDurationPlaylist(tracks, gen, 0);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Admin süresi kadar çal → sıradaki. Süre yoksa ~3 dk sonra geç
 * (admin panelde süre girilmesi önerilir). Çıkışta timer iptal.
 */
async function startUriDurationPlaylist(
  tracks: KaskadMusicTrack[],
  gen: number,
  index: number,
): Promise<void> {
  if (!audioSessionActive || gen !== audioGeneration) return;
  if (!settings.music) return;
  const track = tracks[index];
  if (!track) return;

  clearPlaylistAdvanceTimer();
  stopBuiltinMusicOnly();
  const player = await createPlayer({ uri: track.publicUrl, name: track.title });
  if (!player) return;
  if (!audioSessionActive || gen !== audioGeneration) {
    releasePlayer(player);
    return;
  }

  const tekVeLoop = tracks.length === 1 && (musicCatalog?.loop ?? true);
  player.loop = tekVeLoop;
  player.volume = channelVolume('MUSIC');
  player.play();
  musicPlayer = player;
  musicIsBonus = false;

  if (tekVeLoop) return;

  const ms =
    track.durationMs && track.durationMs > 500
      ? track.durationMs
      : 180_000;

  playlistAdvanceTimer = setTimeout(() => {
    playlistAdvanceTimer = null;
    if (!audioSessionActive || gen !== audioGeneration) return;
    if (musicPlayer !== player) return;
    releasePlayer(player);
    if (musicPlayer === player) musicPlayer = null;
    const next = index + 1;
    const wrap = musicCatalog?.loop !== false;
    if (next < tracks.length) {
      void startUriDurationPlaylist(tracks, gen, next);
    } else if (wrap) {
      void startUriDurationPlaylist(tracks, gen, 0);
    }
  }, ms);
}

function stopBuiltinMusicOnly(): void {
  releasePlayer(musicPlayer);
  musicPlayer = null;
  releasePlayer(ambiencePlayer);
  ambiencePlayer = null;
}

export async function startKaskadMusic(bonus = false): Promise<void> {
  if (!audioSessionActive) return;
  const gen = audioGeneration;
  try {
    await loadKaskadAudioSettings();
    if (!audioSessionActive || gen !== audioGeneration) return;
    if (!settings.music) {
      stopKaskadMusic();
      return;
    }

    // Admin playlist: oyunun kendi BGM/ambience tamamen kapanır
    if (playlistAktif()) {
      if (playlistPlayer) {
        playlistPlayer.volume = channelVolume('MUSIC');
        return;
      }
      await startPlaylistMusic(gen);
      return;
    }

    if (musicPlayer && musicIsBonus === bonus) return;
    stopKaskadMusic();
    if (!settings.music) return;
    const entry = bonus ? GameAudio.bonus_music : GameAudio.background_music;
    if (!entry || entry.source == null) return;
    const player = await createPlayer(entry.source);
    if (!player) return;
    if (!audioSessionActive || gen !== audioGeneration) {
      releasePlayer(player);
      return;
    }
    player.loop = true;
    player.volume = channelVolume('MUSIC');
    player.play();
    musicPlayer = player;
    musicIsBonus = bonus;
    void startKaskadAmbience();
  } catch {
    /* ignore */
  }
}

export async function startKaskadAmbience(): Promise<void> {
  if (!audioSessionActive) return;
  if (playlistAktif()) return; // özel müzikte ambient yok
  const gen = audioGeneration;
  try {
    await loadKaskadAudioSettings();
    if (!audioSessionActive || gen !== audioGeneration) return;
    if (!settings.music || ambiencePlayer) return;
    const entry = GameAudio.ambient_wind;
    if (!entry || entry.source == null) return;
    const player = await createPlayer(entry.source);
    if (!player) return;
    if (!audioSessionActive || gen !== audioGeneration) {
      releasePlayer(player);
      return;
    }
    player.loop = true;
    player.volume = channelVolume('AMBIENCE');
    player.play();
    ambiencePlayer = player;
  } catch {
    /* ignore */
  }
}

export function stopKaskadAmbience(): void {
  releasePlayer(ambiencePlayer);
  ambiencePlayer = null;
}

export function stopKaskadMusic(): void {
  clearPlaylistAdvanceTimer();
  releasePlaylist(playlistPlayer);
  playlistPlayer = null;
  releasePlayer(musicPlayer);
  musicPlayer = null;
  stopKaskadAmbience();
}

export function stopKaskadCountUp(playEnd = false): void {
  countUpToken += 1;
  const had = countUpPlayer != null;
  releasePlayer(countUpPlayer);
  countUpPlayer = null;
  if (playEnd && had && audioSessionActive) void playKaskadSfx('count_up_end');
}

export async function startKaskadCountUp(): Promise<void> {
  if (!audioSessionActive) return;
  const gen = audioGeneration;
  const token = ++countUpToken;
  try {
    await loadKaskadAudioSettings();
    if (!audioSessionActive || gen !== audioGeneration || token !== countUpToken) return;
    if (!settings.sfx) return;
    releasePlayer(countUpPlayer);
    countUpPlayer = null;
    const entry = GameAudio.count_up;
    if (!entry || entry.source == null) return;
    const player = await createPlayer(entry.source);
    if (!player) return;
    if (!audioSessionActive || gen !== audioGeneration || token !== countUpToken) {
      releasePlayer(player);
      return;
    }
    player.loop = true;
    player.volume = channelVolume(entry.channel);
    player.play();
    countUpPlayer = player;
  } catch {
    /* count-up sesi oyunu durdurmaz */
  }
}

/** Oyundan çıkışta tüm sesleri durdur + kaynakları bırak (LiveKit oturumuna dokunmaz) */
export function stopAllKaskadAudio(): void {
  audioSessionActive = false;
  audioGeneration += 1;
  clearPlaylistAdvanceTimer();
  stopKaskadCountUp(false);
  stopKaskadMusic();
  for (const p of recentPlayers) releasePlayer(p);
  recentPlayers.length = 0;
  lastSfxAt.clear();
}

/**
 * AnimationDirector event → ses eşlemesi.
 * Director'a subscribe edilir; ses/görüntü senkron kalır.
 */
export function kaskadAudioEventListener(
  event: GameEventName,
  payload: GameEventPayload,
): void {
  switch (event) {
    case 'SPIN_START':
      void playKaskadSfx('spin_press');
      break;
    case 'SYMBOLS_DROP':
      void playKaskadSfx('symbols_falling');
      break;
    case 'SYMBOL_LAND':
      void playKaskadSfx('cascade_land');
      break;
    case 'MATCH_START':
      void playKaskadSfx('symbol_match');
      break;
    case 'DESTROY':
      void playKaskadSfx('symbol_destroy');
      break;
    case 'CASCADE':
      void playKaskadSfx('cascade_start');
      break;
    case 'MULTIPLIER_REVEAL': {
      const maxMult = payload.maxMultiplier ?? 0;
      void playKaskadSfx('multiplier_spawn');
      if (maxMult >= 25) void playKaskadSfx('multiplier_large');
      else if (maxMult >= 8) void playKaskadSfx('multiplier_medium');
      else void playKaskadSfx('multiplier_small');
      break;
    }
    case 'MULTIPLIER_COLLECT':
      void playKaskadSfx('multiplier_collect');
      break;
    case 'CHARACTER_CAST':
      void playKaskadSfx('character_cast');
      break;
    case 'LIGHTNING_IMPACT':
      void playKaskadSfx('lightning');
      break;
    case 'SCATTER_LAND':
      void playKaskadSfx('scatter_land');
      break;
    case 'ANTICIPATION_START':
      void playKaskadSfx('scatter_anticipation');
      break;
    case 'BONUS_TRIGGER':
      void playKaskadSfx('bonus_trigger');
      break;
    case 'RETRIGGER':
      void playKaskadSfx('retrigger');
      break;
    case 'BONUS_MODE_ENTER':
      // Playlist aktifken bonus BGM'ye geçme — admin müziği devam eder
      if (!playlistAktif()) void startKaskadMusic(true);
      break;
    case 'BIG_WIN': {
      const tier = payload.tier;
      if (tier === 'DIVINE') void playKaskadSfx('legendary_win');
      else if (tier === 'COSMIC') void playKaskadSfx('mega_win');
      else if (tier === 'THUNDER') void playKaskadSfx('big_win');
      else void playKaskadSfx('normal_win');
      break;
    }
    case 'WIN_COUNT_START':
      void startKaskadCountUp();
      break;
    case 'ROUND_FINALIZE':
      stopKaskadCountUp(true);
      break;
    default:
      break;
  }
}
