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

/** Feed ile birleştir — canlı olanlar nabız + güncel kapak/sayı */
export function SonGezilenleriCanliIleBirles(
  kayitlar: SonGezilenKayit[],
  feed: FeedOggesi[],
): SonGezilenGorunum[] {
  const harita = new Map(feed.map((f) => [f.id, f]));
  return kayitlar.map((k) => {
    const feedId = k.tur === 'oda' ? `oda:${k.id}` : `canli:${k.id}`;
    const f = harita.get(feedId);
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
    };
  });
}
