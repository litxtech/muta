import { Platform } from 'react-native';
import {
  endConnection,
  fetchProducts,
  finishTransaction,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  type Purchase,
} from 'expo-iap';
import { FinansIdempotencyAnahtariOlustur } from '../../cuzdan/islemler/FinansIdempotencyAnahtariOlustur';
import { KillSwitchAktifMiSunucu } from '../../ozellik-bayraklari/okuma/KillSwitchAktifMiSunucu';
import { OzellikBayragiAktifMiSunucu } from '../../ozellik-bayraklari/okuma/OzellikBayragiAktifMiSunucu';
import type { CoinPackage } from '../../../types/models';
import { IapReceiptDogrula } from '../dogrulama/IapReceiptDogrula';

export type IapSatinAlSonuc =
  | { ok: true; coinsAdded: number; mock?: boolean }
  | { ok: false; hata: string; kod?: 'kill_switch' | 'flag' | 'store' | 'verify' | 'cancel' };

function storeProductId(pkg: CoinPackage): string {
  if (Platform.OS === 'ios') {
    return pkg.apple_product_id ?? `com.litxtech.muta.${pkg.sku}`;
  }
  return pkg.google_product_id ?? `com.litxtech.muta.${pkg.sku}`;
}

/**
 * Native IAP (StoreKit / Play Billing). Expo Go'da yok — development build gerekir.
 * iOS dijital coin: Stripe YASAK; bu yol zorunlu.
 */
export async function IapIleCoinSatinAl(pkg: CoinPackage): Promise<IapSatinAlSonuc> {
  if (await KillSwitchAktifMiSunucu('kill_coin_purchase')) {
    return { ok: false, hata: 'Coin satın alma kapalı (kill switch).', kod: 'kill_switch' };
  }
  if (!(await OzellikBayragiAktifMiSunucu('iap_enabled'))) {
    return { ok: false, hata: 'IAP kapalı (iap_enabled).', kod: 'flag' };
  }
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return { ok: false, hata: 'IAP yalnızca iOS/Android.', kod: 'store' };
  }

  const sku = storeProductId(pkg);
  const idempotencyKey = FinansIdempotencyAnahtariOlustur('coin_purchase');

  try {
    await initConnection();
  } catch (e) {
    return {
      ok: false,
      hata:
        e instanceof Error
          ? e.message
          : 'Store bağlantısı yok (development build + native IAP gerekir).',
      kod: 'store',
    };
  }

  return new Promise((resolve) => {
    let settled = false;
    const done = (r: IapSatinAlSonuc) => {
      if (settled) return;
      settled = true;
      subUpdate.remove();
      subErr.remove();
      void endConnection().catch(() => undefined);
      resolve(r);
    };

    const subUpdate = purchaseUpdatedListener(async (purchase: Purchase) => {
      try {
        const productId = purchase.productId;
        if (productId !== sku) return;

        const verify = await IapReceiptDogrula({
          packageId: pkg.id,
          store: Platform.OS === 'ios' ? 'apple' : 'google',
          productId,
          transactionId: purchase.transactionId ?? undefined,
          purchaseToken: purchase.purchaseToken ?? undefined,
          idempotencyKey,
        });

        await finishTransaction({ purchase, isConsumable: true });

        if (!verify.ok) {
          done({ ok: false, hata: verify.hata, kod: 'verify' });
          return;
        }
        done({ ok: true, coinsAdded: verify.coinsAdded });
      } catch (e) {
        done({
          ok: false,
          hata: e instanceof Error ? e.message : 'Satın alma işlenemedi',
          kod: 'verify',
        });
      }
    });

    const subErr = purchaseErrorListener((err) => {
      const msg = err?.message ?? 'Satın alma iptal/hata';
      const cancel = /cancel|user.?cancel/i.test(msg);
      done({ ok: false, hata: msg, kod: cancel ? 'cancel' : 'store' });
    });

    void (async () => {
      try {
        const products = await fetchProducts({ skus: [sku], type: 'in-app' });
        if (!products?.length) {
          done({
            ok: false,
            hata: `Store ürünü yok: ${sku}. App Store Connect / Play Console'da oluştur.`,
            kod: 'store',
          });
          return;
        }
        await requestPurchase({
          request: {
            apple: { sku },
            google: { skus: [sku] },
          },
          type: 'in-app',
        });
      } catch (e) {
        done({
          ok: false,
          hata: e instanceof Error ? e.message : 'requestPurchase failed',
          kod: 'store',
        });
      }
    })();
  });
}
