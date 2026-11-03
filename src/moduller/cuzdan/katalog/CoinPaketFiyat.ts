import { Platform } from 'react-native';
import type { CoinPackage } from '../../../types/models';
import i18n from '../../../i18n';
import { AktifSayiLocale } from '../../../i18n/diller';
import { IapOrtamUygunMu } from '../../iap/oturum/IapOturum';

/** Sıralama / katalog referansı — mağazada ödenen tutar DEĞİLDİR. */
export function PaketFiyatTry(pkg: CoinPackage): number {
  if (pkg.store_price_amount != null && Number(pkg.store_price_amount) > 0) {
    return Number(pkg.store_price_amount);
  }
  if (pkg.price_try != null && Number(pkg.price_try) > 0) {
    return Number(pkg.price_try);
  }
  return Math.round(Number(pkg.price_usd) * 35);
}

/** Mağazadan (StoreKit / Play Billing) gerçek fiyat okundu mu? */
export function MagazaFiyatiHazir(pkg: CoinPackage): boolean {
  if (pkg.store_display_price?.trim()) return true;
  const tutar = Number(pkg.store_price_amount);
  return Number.isFinite(tutar) && tutar > 0;
}

/**
 * Fiyat gösterilebilir mi?
 * - iOS/Android + mağaza: yalnızca StoreKit/Play fiyatı gösterilir.
 * - Mağaza oturumu yok (web, Expo Go / dev): katalog fiyatı bilgi amaçlı gösterilir.
 */
export function PaketFiyatiGosterilebilir(pkg: CoinPackage): boolean {
  if (MagazaFiyatiHazir(pkg)) return true;
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return true;
  if (!IapOrtamUygunMu()) return true;
  return false;
}

function ParaYazi(tutar: number, paraBirimi: string | null | undefined, loc: string): string {
  const kod = (paraBirimi ?? '').trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(kod)) {
    try {
      return tutar.toLocaleString(loc, {
        style: 'currency',
        currency: kod,
        maximumFractionDigits: 2,
      });
    } catch {
      /* geçersiz ISO kodu → ₺ biçimine düş */
    }
  }
  return `${tutar.toLocaleString(loc, {
    minimumFractionDigits: Number.isInteger(tutar) ? 0 : 2,
    maximumFractionDigits: 2,
  })} ₺`;
}

/**
 * Kullanıcıya gösterilecek fiyat metni.
 * Öncelik: mağazanın yerelleştirilmiş fiyatı → mağaza tutarı.
 * Native + mağaza oturumu varken fiyat okunamadıysa katalog tutarı fiyat gibi sunulmaz.
 */
export function PaketFiyatYazi(pkg: CoinPackage, locale?: string | null): string {
  const loc = locale ?? AktifSayiLocale(i18n.language);
  const magazaYazi = pkg.store_display_price?.trim();
  if (magazaYazi) return magazaYazi;

  const tutar = Number(pkg.store_price_amount);
  if (Number.isFinite(tutar) && tutar > 0) {
    return ParaYazi(tutar, pkg.store_currency, loc);
  }
  if (!PaketFiyatiGosterilebilir(pkg)) {
    return i18n.t('cuzdanX.fiyatYukleniyor');
  }
  // Web / mağaza oturumu olmayan ortam: katalog referansı
  const n = PaketFiyatTry(pkg);
  if (!n || n <= 0) return '—';
  return `${n.toLocaleString(loc, {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  })} ₺`;
}
