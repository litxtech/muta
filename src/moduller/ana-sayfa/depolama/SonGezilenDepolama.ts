/**
 * Son gezilen ses odaları / izlenen yayınlar — yerel geçmiş.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FeedOggesi } from '../okuma/AnaSayfaIcerikleriniGetir';

const ANAHTAR = 'ana_sayfa_son_gezilen_v1';
export const SON_GEZILEN_MAX = 14;

export type SonGezilenKayit = {
  id: string;
  tur: 'oda' | 'canli';
  title: string;
  coverUrl: string | null;
  hostAd: string | null;
  hostAvatar: string | null;
  mode?: string | null;
  ziyaretAt: string;
  href: string;
  /** Ses odası üye avatar önizlemesi (max 6) */
  uyeAvatarlari?: (string | null)[];
};

export type SonGezilenGorunum = SonGezilenKayit & {
  canli: boolean;
  listenerCount: number;
};

function gecerliMi(x: unknown): x is SonGezilenKayit {
  if (!x || typeof x !== 'object') return false;
  const k = x as SonGezilenKayit;
  return (
    typeof k.id === 'string' &&
    (k.tur === 'oda' || k.tur === 'canli') &&
    typeof k.title === 'string' &&
    typeof k.ziyaretAt === 'string' &&
    typeof k.href === 'string'
  );
}

function sirala(liste: SonGezilenKayit[]): SonGezilenKayit[] {
  return [...liste].sort((a, b) =>
    a.ziyaretAt < b.ziyaretAt ? 1 : a.ziyaretAt > b.ziyaretAt ? -1 : 0,
  );
}

export async function SonGezilenleriGetir(): Promise<SonGezilenKayit[]> {
  try {
    const raw = await AsyncStorage.getItem(ANAHTAR);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return sirala(parsed.filter(gecerliMi)).slice(0, SON_GEZILEN_MAX);
  } catch {
    return [];
  }
}

export async function SonGezileneKaydet(
  input: Omit<SonGezilenKayit, 'ziyaretAt'> & { ziyaretAt?: string },
): Promise<void> {
  if (!input.id || !input.title) return;
  try {
    const mevcut = await SonGezilenleriGetir();
    const kayit: SonGezilenKayit = {
      id: input.id,
      tur: input.tur,
      title: input.title.trim() || (input.tur === 'canli' ? 'Yayın' : 'Oda'),
      coverUrl: input.coverUrl ?? null,
      hostAd: input.hostAd ?? null,
      hostAvatar: input.hostAvatar ?? null,
      mode: input.mode ?? null,
      ziyaretAt: input.ziyaretAt ?? new Date().toISOString(),
      href: input.href,
      uyeAvatarlari: (input.uyeAvatarlari ?? []).slice(0, 6),
    };
    const digerler = mevcut.filter(
      (x) => !(x.tur === kayit.tur && x.id === kayit.id),
    );
    const sonraki = sirala([kayit, ...digerler]).slice(0, SON_GEZILEN_MAX);
    await AsyncStorage.setItem(ANAHTAR, JSON.stringify(sonraki));
  } catch {
    /* yerel geçmiş zorunlu değil */
  }
}

/** Tek kayıt sil (yayın/oda bitti) */
export async function SonGezilendenSil(
  tur: 'oda' | 'canli',
  id: string,
): Promise<void> {
  if (!id) return;
  try {
    const mevcut = await SonGezilenleriGetir();
    const sonraki = mevcut.filter((x) => !(x.tur === tur && x.id === id));
    if (sonraki.length === mevcut.length) return;
    await AsyncStorage.setItem(ANAHTAR, JSON.stringify(sonraki));
  } catch {
    /* ignore */
  }
}

/**
 * Artık canlı olmayan yayınları ve kapanmış/silinmiş ses odalarını geçmişten düşür.
 */
export async function SonGezilenBitmisCanlilariTemizle(
  aktifCanliIdleri: Iterable<string>,
  aktifOdaIdleri?: Iterable<string>,
): Promise<SonGezilenKayit[]> {
  try {
    const aktifCanli = new Set(aktifCanliIdleri);
    const aktifOda =
      aktifOdaIdleri != null ? new Set(aktifOdaIdleri) : null;
    const mevcut = await SonGezilenleriGetir();
    const sonraki = mevcut.filter((x) => {
      if (x.tur === 'canli') return aktifCanli.has(x.id);
      if (x.tur === 'oda') {
        // Oda listesi verilmediyse dokunma (eski çağrılar)
        if (aktifOda == null) return true;
        return aktifOda.has(x.id);
      }
      return true;
    });
    if (sonraki.length !== mevcut.length) {
      await AsyncStorage.setItem(ANAHTAR, JSON.stringify(sonraki));
    }
    return sonraki;
  } catch {
    return [];
  }
}

/** Feed ile birleştir — yalnızca hâlâ canlı olan oda/yayınlar */
export function SonGezilenleriCanliIleBirles(
  kayitlar: SonGezilenKayit[],
  feed: FeedOggesi[],
): SonGezilenGorunum[] {
  const harita = new Map(feed.map((f) => [f.id, f]));
  return kayitlar
    .filter((k) => {
      const feedId = k.tur === 'oda' ? `oda:${k.id}` : `canli:${k.id}`;
      return harita.has(feedId);
    })
    .map((k) => {
      const feedId = k.tur === 'oda' ? `oda:${k.id}` : `canli:${k.id}`;
      const f = harita.get(feedId);
      return kayittanGorunum(k, f);
    });
}

function kayittanGorunum(
  k: SonGezilenKayit,
  f: FeedOggesi | undefined,
): SonGezilenGorunum {
  return {
    ...k,
    canli: !!f,
    listenerCount: f?.listener_count ?? 0,
    title: f?.title?.trim() || k.title,
    coverUrl: f?.cover_url ?? k.coverUrl,
    hostAd:
      f?.host?.display_name?.trim() ||
      (f?.host?.username ? `@${f.host.username}` : null) ||
      k.hostAd,
    hostAvatar: f?.host?.avatar_url ?? k.hostAvatar,
    uyeAvatarlari:
      f?.uye_avatarlari && f.uye_avatarlari.length > 0
        ? f.uye_avatarlari.slice(0, 6)
        : k.uyeAvatarlari && k.uyeAvatarlari.length > 0
          ? k.uyeAvatarlari.slice(0, 6)
          : k.hostAvatar
            ? [k.hostAvatar]
            : [],
  };
}
