/**
 * StoreKit / Play Billing fiyatları — güvenilir tahsilat kaynağı.
 * DB price_try yalnızca referans / admin önizleme.
 */
import { Platform } from 'react-native';
import {
  endConnection,
  fetchProducts,
  initConnection,
} from 'expo-iap';
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

/**
 * Aktif paketlerin mağaza fiyatlarını çeker.
 * Expo Go / web: boş harita (UI DB referansına düşer).
 */
export async function MagazaFiyatlariniYukle(
  packages: CoinPackage[],
): Promise<MagazaFiyatHaritasi> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return {};
  }
  const skus = [
    ...new Set(packages.map(productIdFor).filter(Boolean)),
  ];
  if (!skus.length) return {};

  try {
    await initConnection();
  } catch {
    return {};
  }

  try {
    const products = await fetchProducts({ skus, type: 'in-app' });
    const map: MagazaFiyatHaritasi = {};
    for (const p of products ?? []) {
      const id = (p as { id?: string; productId?: string }).id
        ?? (p as { productId?: string }).productId;
      if (!id) continue;
      const displayPrice =
        (p as { displayPrice?: string }).displayPrice
        ?? (p as { localizedPrice?: string }).localizedPrice
        ?? '';
      const price = Number(
        (p as { price?: number | string }).price ?? NaN,
      );
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
    void endConnection().catch(() => undefined);
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
