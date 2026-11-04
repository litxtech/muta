import i18n from '../../../i18n';
import { Platform } from 'react-native';
import { KillSwitchAktifMiSunucu } from '../../ozellik-bayraklari/okuma/KillSwitchAktifMiSunucu';
import type { CoinPackage } from '../../../types/models';
import { IapIleCoinSatinAl } from './IapIleCoinSatinAl';

export type CoinYukleSonuc =
  | { ok: true; coinsAdded?: number; method: 'iap' }
  | { ok: false; hata: string };

/**
 * Coin yükleme: yalnızca mağaza içi satın alma (StoreKit / Play Billing).
 * Dijital coin için uygulama içinde başka ödeme yolu yoktur.
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

  return { ok: false, hata: iap.hata };
}
