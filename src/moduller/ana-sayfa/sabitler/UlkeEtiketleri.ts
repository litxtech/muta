/**
 * Ana sayfa ülke çipleri — tasarımdaki sıra.
 * Ad/bayrak mevcut i18n + Intl yardımcılarından gelir (tek kaynak).
 */

import i18n from '../../../i18n';
import { ulkeGorunenAd } from '../../kisiler-kesif/utils/KisilerYardimcilar';

export const ANA_SAYFA_ULKE_KODLARI = ['TR', 'DE', 'US', 'SA', 'AE'] as const;

/**
 * Tasarımdaki kısa çip etiketleri (ABD / S.Arabistan / BAE).
 * Intl.DisplayNames uzun adları ("Amerika Birleşik Devletleri") çiplere sığmıyor.
 */
const KISA_ADLAR: Record<string, Partial<Record<'tr' | 'en', string>>> = {
  TR: { tr: 'Türkiye', en: 'Türkiye' },
  DE: { tr: 'Almanya', en: 'Germany' },
  US: { tr: 'ABD', en: 'USA' },
  SA: { tr: 'S.Arabistan', en: 'Saudi Ar.' },
  AE: { tr: 'BAE', en: 'UAE' },
};

function ulkeKodu(kod?: string | null): string {
  return (kod ?? '').trim().toUpperCase();
}

/** Dil başına ad önbelleği — i18n eksik anahtar uyarısı her karede tekrarlanmasın */
const adOnbellek = new Map<string, string>();
let onbellekDil = '';

/** ISO-2 → yerelleşmiş kısa ülke adı; geçersiz kodda boş string */
export function ulkeAdi(kod?: string | null): string {
  const k = ulkeKodu(kod);
  if (!/^[A-Z]{2}$/.test(k)) return '';

  const dil = i18n.language ?? '';
  if (dil !== onbellekDil) {
    adOnbellek.clear();
    onbellekDil = dil;
  }
  const kilit = `${dil}:${k}`;
  const mevcut = adOnbellek.get(kilit);
  if (mevcut !== undefined) return mevcut;

  const ad = KISA_ADLAR[k]?.[dil.slice(0, 2) as 'tr' | 'en'] ?? ulkeGorunenAd(k);
  adOnbellek.set(kilit, ad);
  return ad;
}

export { ulkeBayragi } from '../../kisiler-kesif/utils/KisilerYardimcilar';
