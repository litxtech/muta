import { Platform } from 'react-native';
import i18n from '../../../i18n';
import type { AiMuzikProduct } from '../tipler';
import { AiMuzikIapSatinAl } from './AiMuzikIapSatinAl';

export type AiMuzikSatinAlSonuc =
  | {
      ok: true;
      method: 'iap';
      secondsAdded?: number;
      availableSeconds?: number;
    }
  | { ok: false; hata: string; kod?: string };

/**
 * AI müzik dakika satın alma: yalnızca mağaza içi satın alma (StoreKit / Play Billing).
 * Uygulama içinde başka ödeme yolu yoktur.
 */
export async function AiMuzikPaketSatinAl(
  pkg: AiMuzikProduct,
): Promise<AiMuzikSatinAlSonuc> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return { ok: false, hata: i18n.t('aiMuzik.iapSadeceMobil'), kod: 'store' };
  }

  const iap = await AiMuzikIapSatinAl(pkg);
  if (iap.ok) {
    return {
      ok: true,
      method: 'iap',
      secondsAdded: iap.secondsAdded,
      availableSeconds: iap.availableSeconds,
    };
  }

  if (iap.kod === 'cancel') {
    return { ok: false, hata: i18n.t('auth.iptalEdildi'), kod: 'cancel' };
  }

  return { ok: false, hata: iap.hata, kod: iap.kod };
}

export function AiMuzikPaketFiyatYazi(pkg: AiMuzikProduct): string {
  if (pkg.price_try != null && Number(pkg.price_try) > 0) {
    return `${Number(pkg.price_try).toLocaleString('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ₺`;
  }
  if (pkg.price_usd != null && Number(pkg.price_usd) > 0) {
    return `$${Number(pkg.price_usd).toFixed(2)}`;
  }
  return '—';
}

export function AiMuzikPaketDakika(pkg: AiMuzikProduct): number {
  const sn = Number(pkg.seconds_granted ?? 0) + Number(pkg.bonus_seconds ?? 0);
  return Math.max(1, Math.round(sn / 60));
}
