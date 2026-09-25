/**
 * Sohbet bazlı mesaj taslakları — local-first (AsyncStorage).
 * Sunucuya (Supabase) istek atılmaz; hesap izolasyonu userId ile.
 * V2: opsiyonel replyToMessageId (geriye uyumlu).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const SURUM = 'v1';
const ANAHTAR_ON_EK = `@muta/mesaj_taslaklar_${SURUM}`;

/** Çok eski taslakları temizle (aktif taslağı silme) */
const MAX_YAS_MS = 1000 * 60 * 60 * 24 * 180; // 180 gün

export type MesajTaslakKayit = {
  text: string;
  updatedAt: string;
  /** V2 — yanıtlanan mesaj id (opsiyonel) */
  replyToMessageId?: string | null;
};

export type MesajTaslakHarita = Record<string, MesajTaslakKayit>;

type Dinleyici = (harita: MesajTaslakHarita) => void;

const bellek = new Map<string, MesajTaslakHarita>();
const yukleniyor = new Map<string, Promise<MesajTaslakHarita>>();
const dinleyiciler = new Map<string, Set<Dinleyici>>();

function anahtar(userId: string): string {
  return `${ANAHTAR_ON_EK}:${userId}`;
}

/** Boş / yalnızca boşluk / yalnızca satır sonu → saklama */
export function MesajTaslakBosMu(text: string | null | undefined): boolean {
  if (text == null) return true;
  return text.replace(/\s/g, '').length === 0;
}

function gecerliKayitMi(x: unknown): x is MesajTaslakKayit {
  if (!x || typeof x !== 'object') return false;
  const k = x as MesajTaslakKayit;
  if (typeof k.text !== 'string' || typeof k.updatedAt !== 'string') return false;
  if (
    k.replyToMessageId != null &&
    typeof k.replyToMessageId !== 'string'
  ) {
    return false;
  }
  return true;
}

function kayitNormalize(k: MesajTaslakKayit): MesajTaslakKayit {
  const out: MesajTaslakKayit = {
    text: k.text,
    updatedAt: k.updatedAt,
  };
  if (k.replyToMessageId) out.replyToMessageId = k.replyToMessageId;
  return out;
}

function eskiyiBudayarak(harita: MesajTaslakHarita): MesajTaslakHarita {
  const simdi = Date.now();
  const sonraki: MesajTaslakHarita = {};
  for (const [threadId, kayit] of Object.entries(harita)) {
    if (!gecerliKayitMi(kayit)) continue;
    if (MesajTaslakBosMu(kayit.text) && !kayit.replyToMessageId) continue;
    const t = Date.parse(kayit.updatedAt);
    if (Number.isFinite(t) && simdi - t > MAX_YAS_MS) continue;
    sonraki[threadId] = kayitNormalize(kayit);
  }
  return sonraki;
}

function bildir(userId: string, harita: MesajTaslakHarita): void {
  const set = dinleyiciler.get(userId);
  if (!set) return;
  for (const fn of set) {
    try {
      fn(harita);
    } catch {
      /* dinleyici hatası taslağı bozmasın */
    }
  }
}

async function disktenOku(userId: string): Promise<MesajTaslakHarita> {
  try {
    const raw = await AsyncStorage.getItem(anahtar(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    const ham: MesajTaslakHarita = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof k === 'string' && k.length > 0 && gecerliKayitMi(v)) {
        ham[k] = kayitNormalize(v);
      }
    }
    return eskiyiBudayarak(ham);
  } catch {
    return {};
  }
}

async function diskeYaz(userId: string, harita: MesajTaslakHarita): Promise<void> {
  try {
    const temiz = eskiyiBudayarak(harita);
    if (Object.keys(temiz).length === 0) {
      await AsyncStorage.removeItem(anahtar(userId));
    } else {
      await AsyncStorage.setItem(anahtar(userId), JSON.stringify(temiz));
    }
  } catch {
    /* yerel taslak zorunlu değil */
  }
}

/**
 * Kullanıcının tüm taslak haritasını yükler (liste önizlemesi için tek okuma).
 * Bellekte varsa senkron hızlı yol; yoksa AsyncStorage.
 */
export async function MesajTaslakHaritasiniYukle(
  userId: string,
): Promise<MesajTaslakHarita> {
  if (!userId) return {};
  const cached = bellek.get(userId);
  if (cached) return cached;

  const pending = yukleniyor.get(userId);
  if (pending) return pending;

  const p = disktenOku(userId).then((harita) => {
    bellek.set(userId, harita);
    yukleniyor.delete(userId);
    return harita;
  });
  yukleniyor.set(userId, p);
  return p;
}

/** Bellekte varsa anında metin; yoksa undefined (henüz yüklenmedi). */
export function MesajTaslakSenkronGetir(
  userId: string,
  conversationId: string,
): string | undefined {
  if (!userId || !conversationId) return undefined;
  const harita = bellek.get(userId);
  if (!harita) return undefined;
  const kayit = harita[conversationId];
  if (!kayit || MesajTaslakBosMu(kayit.text)) return '';
  return kayit.text;
}

export async function MesajTaslakGetir(
  userId: string,
  conversationId: string,
): Promise<string> {
  if (!userId || !conversationId) return '';
  const harita = await MesajTaslakHaritasiniYukle(userId);
  const kayit = harita[conversationId];
  if (!kayit || MesajTaslakBosMu(kayit.text)) return '';
  return kayit.text;
}

/** V2 — tam kayıt (text + replyToMessageId) */
export async function MesajTaslakKayitGetir(
  userId: string,
  conversationId: string,
): Promise<MesajTaslakKayit | null> {
  if (!userId || !conversationId) return null;
  const harita = await MesajTaslakHaritasiniYukle(userId);
  const kayit = harita[conversationId];
  if (!kayit) return null;
  if (MesajTaslakBosMu(kayit.text) && !kayit.replyToMessageId) return null;
  return kayitNormalize(kayit);
}

export type MesajTaslakKaydetOpts = {
  replyToMessageId?: string | null;
};

/**
 * Taslağı kaydet veya boşsa sil.
 * updatedAt her yazımda yenilenir.
 * 4. argüman opsiyonel (geriye uyumlu).
 */
export async function MesajTaslakKaydet(
  userId: string,
  conversationId: string,
  text: string,
  opts?: MesajTaslakKaydetOpts,
): Promise<void> {
  if (!userId || !conversationId) return;
  const harita = { ...(await MesajTaslakHaritasiniYukle(userId)) };
  const reply =
    opts && 'replyToMessageId' in opts
      ? opts.replyToMessageId
      : harita[conversationId]?.replyToMessageId;

  if (MesajTaslakBosMu(text) && !reply) {
    if (!(conversationId in harita)) return;
    delete harita[conversationId];
  } else {
    const kayit: MesajTaslakKayit = {
      text,
      updatedAt: new Date().toISOString(),
    };
    if (reply) kayit.replyToMessageId = reply;
    harita[conversationId] = kayit;
  }

  bellek.set(userId, harita);
  bildir(userId, harita);
  await diskeYaz(userId, harita);
}

export async function MesajTaslakSil(
  userId: string,
  conversationId: string,
): Promise<void> {
  if (!userId || !conversationId) return;
  const harita = { ...(await MesajTaslakHaritasiniYukle(userId)) };
  if (!(conversationId in harita)) return;
  delete harita[conversationId];
  bellek.set(userId, harita);
  bildir(userId, harita);
  await diskeYaz(userId, harita);
}

/** Liste UI: conversationId → metin (boşlar yok). */
export function MesajTaslakMetinHaritasi(
  harita: MesajTaslakHarita,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, kayit] of Object.entries(harita)) {
    if (!MesajTaslakBosMu(kayit.text)) out[id] = kayit.text;
  }
  return out;
}

export function MesajTaslakAboneOl(
  userId: string,
  dinleyici: Dinleyici,
): () => void {
  if (!userId) return () => undefined;
  let set = dinleyiciler.get(userId);
  if (!set) {
    set = new Set();
    dinleyiciler.set(userId, set);
  }
  set.add(dinleyici);
  return () => {
    set!.delete(dinleyici);
    if (set!.size === 0) dinleyiciler.delete(userId);
  };
}

/** Hesap değişiminde bellek sızıntısını önle (disk anahtarları userId'li kalır). */
export function MesajTaslakBellekTemizle(userId?: string): void {
  if (userId) {
    bellek.delete(userId);
    yukleniyor.delete(userId);
    dinleyiciler.delete(userId);
    return;
  }
  bellek.clear();
  yukleniyor.clear();
  dinleyiciler.clear();
}
