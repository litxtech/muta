/**
 * AI müzik önizleme oynatıcı — tek parça, expo-audio.
 * Bittiğinde yeniden play → başa sar + oynat.
 */
import { createAudioPlayer } from 'expo-audio';

type PlayerLike = {
  volume: number;
  playing?: boolean;
  currentTime?: number;
  duration?: number;
  loop?: boolean;
  play: () => void;
  pause?: () => void;
  seekTo?: (sec: number) => void | Promise<void>;
  remove?: () => void;
  release?: () => void;
};

const PLAYER_OPTS = {
  keepAudioSessionActive: true,
  updateInterval: 400,
} as const;

let player: PlayerLike | null = null;
let currentUrl: string | null = null;
let currentTrackId: string | null = null;
/** 0..1 — kullanıcı ses seviyesi (varsayılan yüksek) */
let userVolume = 1;

export function AiMuzikCaliyorTrackId(): string | null {
  return player && currentTrackId ? currentTrackId : null;
}

export function AiMuzikSesSeviyesiAl(): number {
  return userVolume;
}

export function AiMuzikSesSeviyesiAyarla(v: number) {
  userVolume = Math.min(1, Math.max(0.05, v));
  if (player) {
    try {
      player.volume = userVolume;
    } catch {
      /* noop */
    }
  }
}

async function seekGuvenli(sn: number) {
  if (!player || typeof player.seekTo !== 'function') return;
  const dur = Number(player.duration ?? 0);
  const hedef =
    dur > 0 ? Math.min(Math.max(0, sn), Math.max(0, dur - 0.05)) : Math.max(0, sn);
  try {
    await Promise.resolve(player.seekTo(hedef));
  } catch {
    /* noop */
  }
}

export async function AiMuzikCal(url: string, trackId?: string) {
  if (!url?.trim()) return;

  // Aynı parça zaten yüklü → devam / başa sar
  if (currentUrl === url && player) {
    try {
      const dur = Number(player.duration ?? 0);
      const cur = Number(player.currentTime ?? 0);
      const bitti =
        !player.playing &&
        dur > 0 &&
        cur >= Math.max(0, dur - 0.35);
      if (bitti || (!player.playing && cur > 0.2 && dur > 0 && cur / dur > 0.98)) {
        await seekGuvenli(0);
      }
      player.play();
      // iOS: ended state’ten play bazen sessiz kalır
      if (!player.playing) {
        await seekGuvenli(0);
        player.play();
      }
    } catch {
      /* recreate below */
      await AiMuzikDurdur();
    }
    if (player && currentUrl === url) {
      if (trackId) currentTrackId = trackId;
      return;
    }
  }

  await AiMuzikDurdur();
  try {
    player = createAudioPlayer({ uri: url }, PLAYER_OPTS) as PlayerLike;
    currentUrl = url;
    currentTrackId = trackId ?? null;
    player.volume = userVolume;
    player.loop = false;
    player.play();
  } catch {
    player = null;
    currentUrl = null;
    currentTrackId = null;
  }
}

/** Başa sar ve çal */
export async function AiMuzikTekrarBaslat() {
  if (!player || !currentUrl) return;
  await seekGuvenli(0);
  try {
    player.play();
  } catch {
    /* noop */
  }
}

export function AiMuzikDuraklat() {
  try {
    player?.pause?.();
  } catch {
    /* noop */
  }
}

export function AiMuzikDevam() {
  try {
    player?.play();
  } catch {
    /* noop */
  }
}

export function AiMuzikCaliyorMu(): boolean {
  return !!player?.playing;
}

export function AiMuzikPozisyonSn(): number {
  return Number(player?.currentTime ?? 0);
}

export function AiMuzikSureSn(): number {
  return Number(player?.duration ?? 0);
}

export async function AiMuzikSeek(sn: number) {
  if (!player) return;
  // Tam saniye hedefi
  await seekGuvenli(Math.round(sn));
}

/** Seek + oynatmaya devam et (scrub sonrası) */
export async function AiMuzikSeekVeOynat(sn: number) {
  await AiMuzikSeek(sn);
  try {
    player?.play();
  } catch {
    /* noop */
  }
}

export async function AiMuzikDurdur() {
  const p = player;
  player = null;
  currentUrl = null;
  currentTrackId = null;
  if (!p) return;
  try {
    p.pause?.();
  } catch {
    /* noop */
  }
  try {
    p.remove?.();
  } catch {
    /* noop */
  }
  try {
    p.release?.();
  } catch {
    /* noop */
  }
}
