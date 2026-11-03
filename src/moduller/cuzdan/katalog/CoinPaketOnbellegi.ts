/**
 * Coin paket kataloğu — disk önbelleği.
 * Ağ yavaşken / çevrimdışıyken mağaza iskeleti anında çizilsin,
 * gerçek katalog arka planda tazelenir.
 */
import type { CoinPackage } from '../../../types/models';
import { asyncKvDepoOlustur } from '../../cevrimdisi/depo/AsyncKvDepo';
import { COIN_PAKET_FALLBACK } from './CoinPaketFallback';
import {
  MagazaFiyatAnlikHaritasi,
  PaketlereMagazaFiyatiUygula,
} from './MagazaFiyatlariniYukle';

const ANAHTAR = 'cuzdan:coin-paket-katalog:v1';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

type KatalogKaydi = { at: number; paketler: CoinPackage[] };

let bellek: KatalogKaydi | null = null;
let okuma: Promise<CoinPackage[] | null> | null = null;

function gecerli(kayit: KatalogKaydi | null): kayit is KatalogKaydi {
  return (
    !!kayit &&
    Array.isArray(kayit.paketler) &&
    kayit.paketler.length > 0 &&
    Date.now() - kayit.at < TTL_MS
  );
}

/** Diskteki katalog — senkron; henüz okunmadıysa null. */
export function CoinPaketKatalogAnlik(): CoinPackage[] | null {
  if (!gecerli(bellek)) return null;
  return bellek.paketler;
}

/** Diskteki kataloğu yükle (tek sefer, in-flight paylaşımlı). */
export function CoinPaketKatalogunuHazirla(): Promise<CoinPackage[] | null> {
  if (gecerli(bellek)) return Promise.resolve(bellek.paketler);
  if (okuma) return okuma;

  const p = (async (): Promise<CoinPackage[] | null> => {
    try {
      const ham = await asyncKvDepoOlustur().getItem(ANAHTAR);
      if (!ham) return null;
      const kayit = JSON.parse(ham) as KatalogKaydi;
      if (!gecerli(kayit)) return null;
      bellek = kayit;
      return kayit.paketler;
    } catch {
      return null;
    }
  })();

  okuma = p;
  void p.then(
    () => {
      if (okuma === p) okuma = null;
    },
    () => {
      if (okuma === p) okuma = null;
    },
  );
  return p;
}

/** Sunucudan gelen kataloğu diske yaz — sonraki açılış anında hazır. */
export function CoinPaketKatalogunuKaydet(paketler: CoinPackage[]): void {
  if (!Array.isArray(paketler) || paketler.length === 0) return;
  const kayit: KatalogKaydi = { at: Date.now(), paketler };
  bellek = kayit;
  void (async () => {
    try {
      await asyncKvDepoOlustur().setItem(ANAHTAR, JSON.stringify(kayit));
    } catch {
      /* disk yazılamadı — bellek yeterli */
    }
  })();
}

/**
 * İlk kare için paket listesi.
 * Öncelik: disk kataloğu → statik tarife. Son bilinen mağaza fiyatları uygulanır,
 * böylece kartlar "mağaza fiyatı yükleniyor" ile kilitli açılmaz.
 */
export function CoinPaketleriAnlikGorunum(): CoinPackage[] {
  const katalog = CoinPaketKatalogAnlik();
  const taban = katalog && katalog.length > 0 ? katalog : COIN_PAKET_FALLBACK;
  const fiyatlar = MagazaFiyatAnlikHaritasi();
  return fiyatlar ? PaketlereMagazaFiyatiUygula(taban, fiyatlar) : [...taban];
}

// Modül yüklenince disk ısıt.
void CoinPaketKatalogunuHazirla();
