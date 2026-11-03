/**
 * StoreKit / Play Billing fiyatları — güvenilir tahsilat kaynağı.
 * DB price_try yalnızca referans / admin önizleme.
 *
 * Kalıcı IAP oturumu + bellek cache + disk cache — sheet her açılışta yavaşlamasın.
 * Disk cache yalnızca ilk kareyi hızlandırır; satın alma sırasında mağaza fiyatı esastır.
 */
import type { CoinPackage } from '../../../types/models';
import { asyncKvDepoOlustur } from '../../cevrimdisi/depo/AsyncKvDepo';
import { IapUrunId } from '../../iap/IapUrunId';
import { IapBaglantisiniAc, IapOrtamUygunMu } from '../../iap/oturum/IapOturum';

export type MagazaFiyatHaritasi = Record<
  string,
  { displayPrice: string; price?: number; currency?: string }
>;

const CACHE_TTL_MS = 10 * 60 * 1000;
const DEPO_ANAHTAR = 'cuzdan:magaza-fiyatlari:v1';
/** Disk fiyatı yalnızca hızlı açılış için tutulur; eski fiyat gösterilmesin. */
const DEPO_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type FiyatKaydi = {
  at: number;
  skuKey: string;
  map: MagazaFiyatHaritasi;
};

let cache: FiyatKaydi | null = null;
let depo: FiyatKaydi | null = null;
let depoOkuma: Promise<FiyatKaydi | null> | null = null;
let inflight: Promise<MagazaFiyatHaritasi> | null = null;

function skuKey(packages: CoinPackage[]): string {
  return packages
    .map(IapUrunId)
    .filter(Boolean)
    .sort()
    .join('|');
}

function gecerli(kayit: FiyatKaydi | null, ttlMs: number): kayit is FiyatKaydi {
  return !!kayit && Date.now() - kayit.at < ttlMs;
}

function haritaGecerliMi(harita: unknown): harita is MagazaFiyatHaritasi {
  return !!harita && typeof harita === 'object' && !Array.isArray(harita);
}

/** Diskteki son fiyat haritası — ilk karede `fiyat yükleniyor` göstermemek için. */
function depoOku(): Promise<FiyatKaydi | null> {
  if (gecerli(depo, DEPO_TTL_MS)) return Promise.resolve(depo);
  if (depoOkuma) return depoOkuma;

  const p = (async (): Promise<FiyatKaydi | null> => {
    try {
      const ham = await asyncKvDepoOlustur().getItem(DEPO_ANAHTAR);
      if (!ham) return null;
      const kayit = JSON.parse(ham) as FiyatKaydi;
      if (!haritaGecerliMi(kayit?.map)) return null;
      if (!gecerli(kayit, DEPO_TTL_MS)) return null;
      depo = kayit;
      return kayit;
    } catch {
      return null;
    }
  })();

  depoOkuma = p;
  void p.then(
    () => {
      if (depoOkuma === p) depoOkuma = null;
    },
    () => {
      if (depoOkuma === p) depoOkuma = null;
    },
  );
  return p;
}

function depoYaz(kayit: FiyatKaydi): void {
  void (async () => {
    try {
      await asyncKvDepoOlustur().setItem(DEPO_ANAHTAR, JSON.stringify(kayit));
    } catch {
      /* disk yazılamadı — bellek cache yeterli */
    }
  })();
}

// Modül yüklenirken disk ısıt — cüzdan/coin ekranı açıldığında hazır olsun.
void depoOku();

/**
 * Son bilinen mağaza fiyatları (bellek → disk).
 * Ağ beklemeden kartları tıklanabilir yapmak için kullanılır.
 */
export function MagazaFiyatAnlikHaritasi(): MagazaFiyatHaritasi | null {
  if (gecerli(cache, CACHE_TTL_MS)) return cache.map;
  if (gecerli(depo, DEPO_TTL_MS)) return depo.map;
  return null;
}

/** Disk okuması bitene kadar kısa bekleme — genelde birkaç ms. */
export function MagazaFiyatDeposunuHazirla(): Promise<void> {
  return depoOku().then(
    () => undefined,
    () => undefined,
  );
}

/** Bellekte taze mağaza fiyatı var mı — gereksiz IAP fetch atla */
export function MagazaFiyatCacheTazeMi(packages: CoinPackage[]): boolean {
  if (!gecerli(cache, CACHE_TTL_MS)) return false;
  if (cache.skuKey !== skuKey(packages)) return false;
  return true;
}

/** Tek SKU bu oturumda mağazadan okundu mu — satın alma öncesi fetchProducts atlamak için */
export function MagazaSkuCacheteMi(sku: string): boolean {
  // Yalnızca bu oturumda fetchProducts ile doğrulanmış fiyat: disk fiyatı StoreKit
  // oturumu olmadan satın alma başlatmak için yeterli değildir.
  if (!gecerli(cache, CACHE_TTL_MS)) return false;
  return !!cache.map[sku]?.displayPrice;
}

/**
 * Aktif paketlerin mağaza fiyatlarını çeker (cache'li).
 */
export async function MagazaFiyatlariniYukle(
  packages: CoinPackage[],
): Promise<MagazaFiyatHaritasi> {
  if (!IapOrtamUygunMu()) return {};
  const skus = [...new Set(packages.map(IapUrunId).filter(Boolean))];
  if (!skus.length) return {};

  const key = skuKey(packages);
  if (gecerli(cache, CACHE_TTL_MS) && cache.skuKey === key) {
    return cache.map;
  }
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      // Disk fiyatı varsa mağaza bağlantısından önce hazır olsun.
      await depoOku();
      const iap = await IapBaglantisiniAc();
      const products = await iap.fetchProducts({ skus, type: 'in-app' });
      const map: MagazaFiyatHaritasi = {};
      for (const p of products ?? []) {
        const id =
          (p as { id?: string; productId?: string }).id ??
          (p as { productId?: string }).productId;
        if (!id) continue;
        const displayPrice =
          (p as { displayPrice?: string }).displayPrice ??
          (p as { localizedPrice?: string }).localizedPrice ??
          '';
        const price = Number((p as { price?: number | string }).price ?? NaN);
        const currency = (p as { currency?: string }).currency;
        if (displayPrice) {
          map[id] = {
            displayPrice,
            price: Number.isFinite(price) ? price : undefined,
            currency,
          };
        }
      }
      if (Object.keys(map).length > 0) {
        cache = { at: Date.now(), skuKey: key, map };
        depoYaz(cache);
        return map;
      }
      // Mağaza boş döndü — eski fiyatı koru (kart "yükleniyor"da kalmasın).
      return MagazaFiyatAnlikHaritasi() ?? {};
    } catch {
      return MagazaFiyatAnlikHaritasi() ?? {};
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** Paketi mağaza fiyatıyla zenginleştir */
export function PaketlereMagazaFiyatiUygula(
  packages: CoinPackage[],
  fiyatlar: MagazaFiyatHaritasi,
): CoinPackage[] {
  return packages.map((pkg) => {
    const id = IapUrunId(pkg);
    const f = fiyatlar[id];
    if (!f) return pkg;
    return {
      ...pkg,
      store_display_price: f.displayPrice,
      store_price_amount: f.price ?? null,
      store_currency: f.currency ?? null,
    };
  });
}
