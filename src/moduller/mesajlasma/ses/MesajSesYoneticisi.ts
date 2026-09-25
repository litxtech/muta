/**
 * DM ses / müzik oynatıcı — tek aktif parça (expo-audio).
 * AI Music ve diğer DM kartları aynı singleton'ı paylaşır.
 * Sesli mesajlarda: tek dokunuşla anında oynat + bitince sıradaki sesliyi
 * (WhatsApp tarzı) kısa geçiş sesiyle otomatik devam ettir.
 */
import { createAudioPlayer } from 'expo-audio';
import { AiMuzikDurdur } from '../../ai-muzik/oynatici/AiMuzikOynatici';

type PlayerLike = {
  volume: number;
  playing?: boolean;
  currentTime?: number;
  duration?: number;
  loop?: boolean;
  playbackRate?: number;
  isLoaded?: boolean;
  play: () => void;
  pause?: () => void;
  seekTo?: (sec: number) => void | Promise<void>;
  remove?: () => void;
  release?: () => void;
  addListener?: (
    event: string,
    listener: (status: {
      didJustFinish?: boolean;
      isLoaded?: boolean;
      playing?: boolean;
      currentTime?: number;
      duration?: number;
    }) => void,
  ) => { remove: () => void };
};

export type MesajSesHiz = 1 | 1.5 | 2;

export type MesajSesKuyrukMadde = {
  key: string;
  url: string;
};

export type MesajSesCalOpts = {
  /** Sesli mesaj kuyruğunda otomatik sırayı aç (varsayılan: kuyrukta ise true) */
  autoplaySirasi?: boolean;
  /** Geçiş sesi çal (otomatik sırada true) */
  gecisSesi?: boolean;
};

const PLAYER_OPTS = {
  keepAudioSessionActive: true,
  updateInterval: 200,
  downloadFirst: true,
} as const;

const GECIS_SESI = require('../../../../assets/sounds/sesli_mesaj_gecis.wav');

let player: PlayerLike | null = null;
let statusSub: { remove: () => void } | null = null;
let currentKey: string | null = null;
let currentUrl: string | null = null;
let speed: MesajSesHiz = 1;
let voiceQueue: MesajSesKuyrukMadde[] = [];
/** Kullanıcı bir sesli mesaj başlattıysa bitince sıradakine geç */
let autoplayChain = false;
/** Aynı bitiş olayını iki kez işleme */
let finishLock = false;
let calGeneration = 0;
const dinleyiciler = new Set<() => void>();

function bildir() {
  for (const fn of dinleyiciler) {
    try {
      fn();
    } catch {
      /* noop */
    }
  }
}

function statusDinlemeyiKes() {
  try {
    statusSub?.remove();
  } catch {
    /* noop */
  }
  statusSub = null;
}

export function MesajSesAboneOl(fn: () => void): () => void {
  dinleyiciler.add(fn);
  return () => {
    dinleyiciler.delete(fn);
  };
}

export function MesajSesAktifAnahtar(): string | null {
  return player && currentKey ? currentKey : null;
}

export function MesajSesCaliyorMu(key?: string): boolean {
  if (!player?.playing) return false;
  if (key != null) return currentKey === key;
  return true;
}

export function MesajSesPozisyonSn(): number {
  return Number(player?.currentTime ?? 0);
}

export function MesajSesSureSn(): number {
  return Number(player?.duration ?? 0);
}

export function MesajSesHizAl(): MesajSesHiz {
  return speed;
}

/** Sohbet ekranı kronolojik sesli mesaj listesini bildirir (eski → yeni). */
export function MesajSesSesliKuyrukAyarla(items: MesajSesKuyrukMadde[]) {
  voiceQueue = (items ?? []).filter((x) => !!x?.key && !!x?.url?.trim());
}

export function MesajSesOtomatikSirayiKes() {
  autoplayChain = false;
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

function hizUygula() {
  if (!player) return;
  try {
    player.playbackRate = speed;
  } catch {
    /* noop */
  }
}

function oynatGuvenli(p: PlayerLike) {
  try {
    p.play();
  } catch {
    /* noop */
  }
}

/** Yüklenene kadar bekle, sonra hemen play — ilk dokunuşta sessiz kalmayı önler. */
function hazirOluncaOynat(p: PlayerLike, gen: number): Promise<void> {
  return new Promise((resolve) => {
    if (p.isLoaded) {
      oynatGuvenli(p);
      resolve();
      return;
    }
    let done = false;
    const bitir = () => {
      if (done) return;
      done = true;
      try {
        sub?.remove();
      } catch {
        /* noop */
      }
      resolve();
    };
    const sub = p.addListener?.('playbackStatusUpdate', (st) => {
      if (gen !== calGeneration) {
        bitir();
        return;
      }
      if (st.isLoaded || st.playing) {
        oynatGuvenli(p);
        bitir();
      }
    });
    // Fallback: event gelmezse yine de dene
    oynatGuvenli(p);
    setTimeout(() => {
      if (gen === calGeneration && p === player) oynatGuvenli(p);
      bitir();
    }, 800);
  });
}

async function gecisSesiniCal(): Promise<void> {
  return new Promise((resolve) => {
    let p: PlayerLike | null = null;
    let sub: { remove: () => void } | null = null;
    let settled = false;
    const bitir = () => {
      if (settled) return;
      settled = true;
      try {
        sub?.remove();
      } catch {
        /* noop */
      }
      try {
        p?.pause?.();
      } catch {
        /* noop */
      }
      try {
        p?.remove?.();
      } catch {
        /* noop */
      }
      try {
        p?.release?.();
      } catch {
        /* noop */
      }
      resolve();
    };
    try {
      p = createAudioPlayer(GECIS_SESI, {
        keepAudioSessionActive: true,
        updateInterval: 100,
      }) as PlayerLike;
      p.volume = 0.55;
      p.loop = false;
      sub =
        p.addListener?.('playbackStatusUpdate', (st) => {
          if (st.isLoaded && !st.playing && !st.didJustFinish) {
            oynatGuvenli(p!);
          }
          if (st.didJustFinish) bitir();
        }) ?? null;
      oynatGuvenli(p);
      setTimeout(bitir, 450);
    } catch {
      bitir();
    }
  });
}

async function siradakiSesliyiOynat() {
  if (!autoplayChain || !currentKey) return;
  const idx = voiceQueue.findIndex((v) => v.key === currentKey);
  if (idx < 0) {
    autoplayChain = false;
    return;
  }
  const next = voiceQueue[idx + 1];
  if (!next?.url) {
    autoplayChain = false;
    return;
  }
  await gecisSesiniCal();
  if (!autoplayChain) return;
  await MesajSesCal(next.key, next.url, {
    autoplaySirasi: true,
    gecisSesi: false,
  });
}

function statusBagla(p: PlayerLike, gen: number) {
  statusDinlemeyiKes();
  if (typeof p.addListener !== 'function') return;
  statusSub = p.addListener('playbackStatusUpdate', (st) => {
    if (gen !== calGeneration || p !== player) return;
    bildir();
    if (!st.didJustFinish || finishLock) return;
    finishLock = true;
    if (autoplayChain && currentKey && voiceQueue.some((v) => v.key === currentKey)) {
      void siradakiSesliyiOynat().finally(() => {
        finishLock = false;
      });
    } else {
      autoplayChain = false;
      finishLock = false;
      bildir();
    }
  });
}

export async function MesajSesDurdur() {
  calGeneration += 1;
  statusDinlemeyiKes();
  const p = player;
  player = null;
  currentKey = null;
  currentUrl = null;
  finishLock = false;
  if (!p) {
    bildir();
    return;
  }
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
  bildir();
}

export async function MesajSesDuraklat() {
  autoplayChain = false;
  try {
    player?.pause?.();
  } catch {
    /* noop */
  }
  bildir();
}

export async function MesajSesHizAyarla(h: MesajSesHiz) {
  speed = h;
  hizUygula();
  bildir();
}

export async function MesajSesSeek(sn: number) {
  await seekGuvenli(sn);
  bildir();
}

export async function MesajSesSeekVeOynat(sn: number) {
  await seekGuvenli(sn);
  if (currentKey && voiceQueue.some((v) => v.key === currentKey)) {
    autoplayChain = true;
  }
  try {
    player?.play();
  } catch {
    /* noop */
  }
  bildir();
}

/**
 * @param key — mesaj id veya unique kart anahtarı (tek aktif playback)
 * @param url — audio URI
 */
export async function MesajSesCal(
  key: string,
  url: string,
  opts?: MesajSesCalOpts,
) {
  if (!key || !url?.trim()) return;

  const kuyrukta = voiceQueue.some((v) => v.key === key);
  if (opts?.autoplaySirasi === false) {
    autoplayChain = false;
  } else if (kuyrukta || opts?.autoplaySirasi === true) {
    autoplayChain = true;
  } else {
    autoplayChain = false;
  }

  // Aynı parça → toggle / devam
  if (currentKey === key && currentUrl === url && player) {
    try {
      if (player.playing) {
        autoplayChain = false;
        player.pause?.();
        bildir();
        return;
      }
      const dur = Number(player.duration ?? 0);
      const cur = Number(player.currentTime ?? 0);
      const bitti = dur > 0 && cur >= Math.max(0, dur - 0.35);
      if (bitti) await seekGuvenli(0);
      finishLock = false;
      hizUygula();
      oynatGuvenli(player);
      // Hâlâ başlamadıysa yeniden dene (yüklenmemiş kalmış olabilir)
      if (!player.playing) {
        await hazirOluncaOynat(player, calGeneration);
      }
      bildir();
      return;
    } catch {
      await MesajSesDurdur();
    }
  }

  // Diğer oynatıcıları durdur
  try {
    await AiMuzikDurdur();
  } catch {
    /* noop */
  }
  await MesajSesDurdur();

  const gen = ++calGeneration;
  finishLock = false;

  try {
    player = createAudioPlayer({ uri: url }, PLAYER_OPTS) as PlayerLike;
    currentKey = key;
    currentUrl = url;
    player.volume = 1;
    player.loop = false;
    hizUygula();
    statusBagla(player, gen);
    bildir();
    await hazirOluncaOynat(player, gen);
    if (gen === calGeneration) bildir();
  } catch {
    if (gen === calGeneration) {
      player = null;
      currentKey = null;
      currentUrl = null;
      statusDinlemeyiKes();
      bildir();
    }
  }
}

/** Singleton facade */
export const MesajSesYoneticisi = {
  cal: MesajSesCal,
  durdur: MesajSesDurdur,
  duraklat: MesajSesDuraklat,
  seek: MesajSesSeek,
  seekVeOynat: MesajSesSeekVeOynat,
  hizAyarla: MesajSesHizAyarla,
  hizAl: MesajSesHizAl,
  aktifAnahtar: MesajSesAktifAnahtar,
  caliyorMu: MesajSesCaliyorMu,
  pozisyonSn: MesajSesPozisyonSn,
  sureSn: MesajSesSureSn,
  aboneOl: MesajSesAboneOl,
  sesliKuyrukAyarla: MesajSesSesliKuyrukAyarla,
  otomatikSirayiKes: MesajSesOtomatikSirayiKes,
};
