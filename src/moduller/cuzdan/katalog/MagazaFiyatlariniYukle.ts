/**
 * StoreKit / Play Billing fiyatları — güvenilir tahsilat kaynağı.
 * DB price_try yalnızca referans / admin önizleme.
 *
 * Önemli: Expo Go / native modül yokken ASLA çökme.
 * Static import yerine dynamic import — canlı/cüzdan mount güvenli.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type { CoinPackage } from '../../../types/models';

export type MagazaFiyatHaritasi = Record<
  string,
  { displayPrice: string; price?: number; currency?: string }
>;

function productIdFor(pkg: CoinPackage): string {
  if (Platform.OS === 'ios') {
    return pkg.apple_product_id ?? pkg.sku;
  }
  return pkg.google_product_id ?? pkg.sku;
}

/** Expo Go veya web — native IAP yok */
function iapOrtamUygunMu(): boolean {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;
  if (Constants.appOwnership === 'expo') return false;
  return true;
}

/**
 * Aktif paketlerin mağaza fiyatlarını çeker.
 * Expo Go / web / native yok: boş harita (UI DB referansına düşer).
 */
export async function MagazaFiyatlariniYukle(
  packages: CoinPackage[],
): Promise<MagazaFiyatHaritasi> {
  if (!iapOrtamUygunMu()) return {};
  const skus = [
    ...new Set(packages.map(productIdFor).filter(Boolean)),
  ];
  if (!skus.length) return {};

  try {
    const iap = await import('expo-iap');
    try {
      await iap.initConnection();
    } catch {
      return {};
    }

    try {
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
      return map;
    } catch {
      return {};
    } finally {
      void iap.endConnection().catch(() => undefined);
    }
  } catch {
    return {};
  }
}

/** Paketi mağaza fiyatıyla zenginleştir */
export function PaketlereMagazaFiyatiUygula(
  packages: CoinPackage[],
  fiyatlar: MagazaFiyatHaritasi,
): CoinPackage[] {
  return packages.map((pkg) => {
    const id = productIdFor(pkg);
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
