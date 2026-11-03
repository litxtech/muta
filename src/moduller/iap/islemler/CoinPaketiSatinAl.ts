import i18n from '../../../i18n';
import { Platform } from 'react-native';
import { FinansIdempotencyAnahtariOlustur } from '../../cuzdan/islemler/FinansIdempotencyAnahtariOlustur';
import { KillSwitchAktifMiSunucu } from '../../ozellik-bayraklari/okuma/KillSwitchAktifMiSunucu';
import type { CoinPackage } from '../../../types/models';
import { CoinSatinAlOnayla } from './CoinSatinAlOnayla';
import { IapIleCoinSatinAl } from './IapIleCoinSatinAl';
import { SunucuPaketId } from '../../cuzdan/katalog/CoinPaketSunucuId';

export type CoinYukleSonuc =
  | { ok: true; coinsAdded?: number; method: 'iap' | 'dev' }
  | { ok: false; hata: string };

/**
 * Coin yükleme: yalnızca mağaza içi satın alma (StoreKit / Play Billing).
 * Dijital coin için uygulama içinde başka ödeme yolu yoktur.
 * - __DEV__ + store yoksa: manuel sandbox RPC (yalnızca geliştirme)
 */
export async function CoinPaketiSatinAl(pkg: CoinPackage): Promise<CoinYukleSonuc> {
  if (await KillSwitchAktifMiSunucu('kill_coin_purchase')) {
    return { ok: false, hata: i18n.t('cuzdan.coinSatinAlmaKapali') };
  }

  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return { ok: false, hata: i18n.t('cuzdanX.coinYalnizMobil') };
  }

  const iap = await IapIleCoinSatinAl(pkg);
  if (iap.ok) return { ok: true, coinsAdded: iap.coinsAdded, method: 'iap' };
  if (iap.kod === 'cancel') return { ok: false, hata: i18n.t('auth.iptalEdildi') };

  // Dev fallback: Expo Go / store ürünü yokken
  if (__DEV__ && (iap.kod === 'store' || iap.kod === 'flag')) {
    const dev = await CoinSatinAlOnayla({
      packageId: await SunucuPaketId(pkg),
      store: 'manual',
      amountUsd: pkg.price_usd,
      idempotencyKey: FinansIdempotencyAnahtariOlustur('coin_purchase'),
    });
    if (!dev.ok) return { ok: false, hata: `${iap.hata} · dev: ${dev.hata}` };
    return { ok: true, coinsAdded: dev.coinsAdded, method: 'dev' };
  }

  return { ok: false, hata: iap.hata };
}
