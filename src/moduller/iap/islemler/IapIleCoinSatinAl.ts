import i18n from '../../../i18n';
import { Platform } from 'react-native';
import { FinansIdempotencyAnahtariOlustur } from '../../cuzdan/islemler/FinansIdempotencyAnahtariOlustur';
import { KillSwitchAktifMiSunucu } from '../../ozellik-bayraklari/okuma/KillSwitchAktifMiSunucu';
import { OzellikBayragiAktifMiSunucu } from '../../ozellik-bayraklari/okuma/OzellikBayragiAktifMiSunucu';
import type { CoinPackage } from '../../../types/models';
import { IapReceiptDogrula } from '../dogrulama/IapReceiptDogrula';
import { IapUrunId } from '../IapUrunId';
import {
  IapBaglantisiniAc,
  IapBaglantisiniGecersizKil,
  IapBaglantisiniTazele,
  IapOrtamUygunMu,
  IapTxnIsle,
  IapTxnIslendiMi,
} from '../oturum/IapOturum';
import { MagazaSkuCacheteMi } from '../../cuzdan/katalog/MagazaFiyatlariniYukle';
import { SunucuPaketId } from '../../cuzdan/katalog/CoinPaketSunucuId';

export type IapSatinAlSonuc =
  | { ok: true; coinsAdded: number; mock?: boolean }
  | {
      ok: false;
      hata: string;
      kod?: 'kill_switch' | 'flag' | 'store' | 'verify' | 'cancel';
    };

/**
 * Satın alma kilidi.
 * Emniyet süresi: mağaza yanıt vermezse kilit sonsuza kadar kapalı kalmasın
 * (eski davranış: ikinci satın alma "Satın alma" hatasıyla düşüyordu).
 */
const KILIT_EMNIYET_MS = 180_000;
/** Sheet + Face ID / şifre / banka doğrulaması için üst sınır. */
const ISLEM_ZAMAN_ASIMI_MS = 150_000;

let satinAlmaKilit = false;
let satinAlmaKilitZamani = 0;

function kilitliMi(): boolean {
  if (!satinAlmaKilit) return false;
  if (Date.now() - satinAlmaKilitZamani > KILIT_EMNIYET_MS) {
    satinAlmaKilit = false;
    return false;
  }
  return true;
}

function kilitle(): void {
  satinAlmaKilit = true;
  satinAlmaKilitZamani = Date.now();
}

function kilitBirak(): void {
  satinAlmaKilit = false;
}

/** StoreKit / Play oturumu düşmüşse çağrı "not prepared" benzeri hata verir. */
const BAGLANTI_HATA_KODLARI = new Set([
  'not-prepared',
  'connection-closed',
  'service-disconnected',
  'init-connection',
  'iap-not-available',
  'billing-unavailable',
  'network-error',
  'service-timeout',
  'service-error',
  'query-product',
]);

function baglantiHatasi(e: unknown): boolean {
  const kod = (e as { code?: unknown } | null)?.code;
  if (typeof kod === 'string' && BAGLANTI_HATA_KODLARI.has(kod.toLowerCase())) {
    return true;
  }
  const mesaj = e instanceof Error ? e.message : String(e ?? '');
  return /not.?prepared|connection.?closed|service.?disconnected|init.?connection|billing.?unavailable|iap.?not.?available|store.?not.?available/i.test(
    mesaj,
  );
}

type PurchaseLike = {
  productId?: string;
  transactionId?: string;
  id?: string;
  purchaseToken?: string;
  transactionDate?: number;
};

type DrainSonuc = {
  /** false: doğrulanamayan pending var — yeni satın alma başlatma */
  temiz: boolean;
  /** Bu drain sırasında sunucunun yazdığı coin (önceki yarım kalan alım) */
  eklenen: number;
};

/**
 * Bitmemiş StoreKit txn kuyruğunu temizle.
 * Bitmemiş consumable varken 2. requestPurchase sheet/side-button
 * göstermeden eski txn'i tekrar basar.
 */
async function bekleyenleriTemizle(
  iap: typeof import('expo-iap'),
  sku: string,
  pkgId: string,
): Promise<DrainSonuc> {
  let pending: PurchaseLike[] = [];
  try {
    pending = (await iap.getAvailablePurchases()) as PurchaseLike[];
  } catch {
    // Kuyruk okunamadı — satın almayı engelleme (requestPurchase yine çalışır).
    return { temiz: true, eklenen: 0 };
  }

  let temiz = true;
  let eklenen = 0;

  for (const p of pending ?? []) {
    if (p.productId !== sku) continue;
    const txnId = p.transactionId ?? p.id ?? null;

    if (IapTxnIslendiMi(txnId)) {
      try {
        await iap.finishTransaction({
          purchase: p as never,
          isConsumable: true,
        });
      } catch {
        /* */
      }
      continue;
    }

    // Ödemesi alınmış ama coin'i yazılmamış işlem kapatılırsa kullanıcı kaybeder:
    // yalnızca sunucu onaylarsa veya kesin reddederse kapat.
    const sonuc = await IapReceiptDogrula({
      packageId: pkgId,
      store: Platform.OS === 'ios' ? 'apple' : 'google',
      productId: sku,
      transactionId: txnId ?? undefined,
      purchaseToken: p.purchaseToken ?? undefined,
      idempotencyKey: FinansIdempotencyAnahtariOlustur('coin_purchase_drain'),
    });
    if (!sonuc.ok && !sonuc.kesin) {
      temiz = false;
      continue;
    }
    if (sonuc.ok && sonuc.coinsAdded > 0) {
      eklenen += sonuc.coinsAdded;
    }
    try {
      await iap.finishTransaction({
        purchase: p as never,
        isConsumable: true,
      });
    } catch {
      /* */
    }
    if (txnId) IapTxnIsle(txnId);
  }
  return { temiz, eklenen };
}

/**
 * Native IAP (StoreKit / Play Billing).
 * - Kalıcı bağlantı (IapOturum) + düşen bağlantıyı tazeleyip tek deneme
 * - requestPurchase ÖNCESİ pending drain (2. alımda side-button atlama)
 * - transactionId dedupe
 * - yanıt gelmezse kilit emniyet süresiyle açılır
 */
export async function IapIleCoinSatinAl(
  pkg: CoinPackage,
): Promise<IapSatinAlSonuc> {
  if (await KillSwitchAktifMiSunucu('kill_coin_purchase')) {
    return {
      ok: false,
      hata: i18n.t('cuzdanX.coinSatinAlmaKapali'),
      kod: 'kill_switch',
    };
  }
  if (!(await OzellikBayragiAktifMiSunucu('iap_enabled'))) {
    return { ok: false, hata: i18n.t('cuzdanX.iapKapaliFlag'), kod: 'flag' };
  }
  if (!IapOrtamUygunMu()) {
    return {
      ok: false,
      hata: i18n.t('cuzdanX.coinExpoGo'),
      kod: 'store',
    };
  }
  if (kilitliMi()) {
    return {
      ok: false,
      hata: i18n.t('cuzdanX.satinAlmaSuruyor'),
      kod: 'store',
    };
  }

  const sku = IapUrunId(pkg);
  if (!sku) {
    return {
      ok: false,
      hata: i18n.t('cuzdanY.storeUrunuYok', { sku: '?' }),
      kod: 'store',
    };
  }

  let iap: typeof import('expo-iap');
  try {
    iap = await IapBaglantisiniAc();
  } catch (e) {
    return {
      ok: false,
      hata:
        e instanceof Error
          ? e.message
          : i18n.t('cuzdanX.storeBaglantisiYokNative'),
      kod: 'store',
    };
  }

  // Edge/RPC `packageId` uuid bekler — offline fallback id'si "1".."8" olabilir.
  const sunucuId = await SunucuPaketId(pkg);

  const {
    fetchProducts,
    finishTransaction,
    purchaseErrorListener,
    purchaseUpdatedListener,
    requestPurchase,
  } = iap;

  const idempotencyKey = FinansIdempotencyAnahtariOlustur('coin_purchase');

  kilitle();

  return new Promise((resolve) => {
    let settled = false;
    /** requestPurchase çağrılana kadar false — eski pending'i yutma */
    let purchaseArmed = false;
    const armedAt = { ms: 0 };
    let zamanlayici: ReturnType<typeof setTimeout> | null = null;

    const done = (r: IapSatinAlSonuc) => {
      if (settled) return;
      settled = true;
      purchaseArmed = false;
      kilitBirak();
      if (zamanlayici) {
        clearTimeout(zamanlayici);
        zamanlayici = null;
      }
      try {
        subUpdate.remove();
      } catch {
        /* */
      }
      try {
        subErr.remove();
      } catch {
        /* */
      }
      // endConnection YOK — oturum açık kalsın
      resolve(r);
    };

    const subUpdate = purchaseUpdatedListener(async (purchase) => {
      try {
        const productId = purchase.productId;
        if (productId !== sku) return;

        const txnId =
          purchase.transactionId ??
          (purchase as { id?: string }).id ??
          null;

        // 1) Zaten işledik → finish et (kuyruk temizlensin)
        if (IapTxnIslendiMi(txnId)) {
          try {
            await finishTransaction({ purchase, isConsumable: true });
          } catch {
            /* */
          }
          return;
        }

        // 2) requestPurchase öncesi replay — verify, onaylanırsa finish; promise'i çözme
        if (!purchaseArmed) {
          const onceki = await IapReceiptDogrula({
            packageId: sunucuId,
            store: Platform.OS === 'ios' ? 'apple' : 'google',
            productId,
            transactionId: txnId ?? undefined,
            purchaseToken: purchase.purchaseToken ?? undefined,
            idempotencyKey: FinansIdempotencyAnahtariOlustur(
              'coin_purchase_drain',
            ),
          });
          if (!onceki.ok && !onceki.kesin) return;
          try {
            await finishTransaction({ purchase, isConsumable: true });
          } catch {
            /* */
          }
          if (txnId) IapTxnIsle(txnId);
          return;
        }

        // 3) Çok eski txn (armed'dan önce) — Apple bazen eskiyi tekrar basar; sunucu idempotent
        const txnMs = Number(
          (purchase as { transactionDate?: number }).transactionDate ?? 0,
        );
        if (txnMs > 0 && armedAt.ms > 0 && txnMs + 2000 < armedAt.ms) {
          const eski = await IapReceiptDogrula({
            packageId: sunucuId,
            store: Platform.OS === 'ios' ? 'apple' : 'google',
            productId,
            transactionId: txnId ?? undefined,
            purchaseToken: purchase.purchaseToken ?? undefined,
            idempotencyKey: FinansIdempotencyAnahtariOlustur(
              'coin_purchase_drain',
            ),
          });
          if (!eski.ok && !eski.kesin) return;
          try {
            await finishTransaction({ purchase, isConsumable: true });
          } catch {
            /* */
          }
          if (txnId) IapTxnIsle(txnId);
          return;
        }

        const verify = await IapReceiptDogrula({
          packageId: sunucuId,
          store: Platform.OS === 'ios' ? 'apple' : 'google',
          productId,
          transactionId: txnId ?? undefined,
          purchaseToken: purchase.purchaseToken ?? undefined,
          idempotencyKey,
        });

        if (!verify.ok && !verify.kesin) {
          // İşlem açık kalır; mağaza bir sonraki açılışta yeniden iletir ve tekrar doğrulanır.
          done({
            ok: false,
            hata: i18n.t('cuzdanY.satinAlmaDogrulamaBekliyor'),
            kod: 'verify',
          });
          return;
        }

        try {
          await finishTransaction({ purchase, isConsumable: true });
        } catch {
          /* finish başarısız olsa da verify OK ise coin yazılmış olabilir */
        }

        if (txnId) IapTxnIsle(txnId);

        if (!verify.ok) {
          done({ ok: false, hata: verify.hata, kod: 'verify' });
          return;
        }
        done({ ok: true, coinsAdded: verify.coinsAdded });
      } catch (e) {
        console.warn('[iap] satın alma işlenemedi', e);
        done({
          ok: false,
          hata:
            e instanceof Error
              ? e.message
              : i18n.t('cuzdanY.satinAlmaIslenemedi'),
          kod: 'verify',
        });
      }
    });

    const subErr = purchaseErrorListener((err) => {
      if (!purchaseArmed) return;
      const msg = err?.message ?? i18n.t('cuzdanY.satinAlmaIptalHata');
      console.warn('[iap] purchase error', err?.code ?? '', msg);
      // Bağlantı düştüyse bayat `bagli` bayrağını temizle — sonraki deneme reconnect etsin.
      if (baglantiHatasi(err)) IapBaglantisiniGecersizKil();
      const cancel = /cancel|user.?cancel/i.test(msg);
      done({ ok: false, hata: msg, kod: cancel ? 'cancel' : 'store' });
    });

    /** Mağaza yanıtı gelmezse kilidi bırak; işlem açık kalırsa sonraki açılışta yazılır. */
    zamanlayici = setTimeout(() => {
      zamanlayici = null;
      if (settled) return;
      console.warn('[iap] satın alma zaman aşımı', { sku });
      done({
        ok: false,
        hata: i18n.t('cuzdanY.satinAlmaZamanAsimi'),
        kod: 'store',
      });
    }, ISLEM_ZAMAN_ASIMI_MS);

    void (async () => {
      try {
        // Önce bitmemiş txn'leri temizle — aksi halde 2. alım sheet atlar.
        const drain = await bekleyenleriTemizle(iap, sku, sunucuId);
        if (!drain.temiz) {
          done({
            ok: false,
            hata: i18n.t('cuzdanY.satinAlmaDogrulamaBekliyor'),
            kod: 'verify',
          });
          return;
        }
        // Önceki yarım kalan alım bu drain'de yazıldıysa yeni ödeme isteme.
        if (drain.eklenen > 0) {
          done({ ok: true, coinsAdded: drain.eklenen });
          return;
        }

        const urunHazir = async () => {
          // Fiyat cache'te varsa ürün zaten biliniyor — ekstra fetchProducts gecikmesi yok
          if (MagazaSkuCacheteMi(sku)) return true;
          const products = await fetchProducts({ skus: [sku], type: 'in-app' });
          return !!products?.length;
        };

        if (!(await urunHazir())) {
          done({
            ok: false,
            hata: i18n.t('cuzdanY.storeUrunuYok', { sku }),
            kod: 'store',
          });
          return;
        }

        const iste = async () => {
          purchaseArmed = true;
          armedAt.ms = Date.now();
          await requestPurchase({
            request: {
              apple: { sku },
              google: { skus: [sku] },
            },
            type: 'in-app',
          });
        };

        try {
          await iste();
        } catch (e) {
          // Bağlantı düşmüşse bir kez tazeleyip tekrar dene.
          if (!baglantiHatasi(e)) throw e;
          console.warn('[iap] bağlantı tazeleniyor', e);
          purchaseArmed = false;
          iap = await IapBaglantisiniTazele();
          const drain2 = await bekleyenleriTemizle(iap, sku, sunucuId);
          if (!drain2.temiz) {
            done({
              ok: false,
              hata: i18n.t('cuzdanY.satinAlmaDogrulamaBekliyor'),
              kod: 'verify',
            });
            return;
          }
          if (drain2.eklenen > 0) {
            done({ ok: true, coinsAdded: drain2.eklenen });
            return;
          }
          if (!(await urunHazir())) {
            done({
              ok: false,
              hata: i18n.t('cuzdanY.storeUrunuYok', { sku }),
              kod: 'store',
            });
            return;
          }
          await iste();
        }
      } catch (e) {
        console.warn('[iap] satın alma başlatılamadı', e);
        done({
          ok: false,
          hata:
            e instanceof Error
              ? e.message
              : i18n.t('cuzdanX.satinAlmaIstekBasarisiz'),
          kod: 'store',
        });
      }
    })();
  });
}
