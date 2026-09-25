import i18n from '../../../i18n';
import { DilNormalizeEt, DIL_LOCALE_MAP } from '../../../i18n/diller';

/** ISO 3166-1 alpha-2 → bayrak emoji (public country display) */
export function ulkeBayragi(code: string | null | undefined): string {
  if (!code || code.length !== 2) return '';
  const cc = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return '';
  const A = 0x1f1e6;
  return String.fromCodePoint(
    A + (cc.charCodeAt(0) - 65),
    A + (cc.charCodeAt(1) - 65),
  );
}

/** Saniye → "X dk Y sn" (tahmini süre UI) */
export function saniyeMetni(totalSec: number | null | undefined): string {
  if (totalSec == null || !Number.isFinite(totalSec) || totalSec < 0) return '—';
  const s = Math.floor(totalSec);
  const dk = Math.floor(s / 60);
  const sn = s % 60;
  if (dk <= 0) return i18n.t('kisilerX.sn', { n: sn });
  return i18n.t('kisilerX.dkSn', {
    dk,
    sn: sn.toString().padStart(2, '0'),
  });
}

/** Desteklenen ülke kodları (sıra sabit; isimler Intl / i18n) */
export const KISILER_ULKE_KODLARI = [
  'TR',
  'AZ',
  'DE',
  'US',
  'GB',
  'FR',
  'NL',
  'BE',
  'AT',
  'CH',
  'SE',
  'NO',
  'DK',
  'FI',
  'IT',
  'ES',
  'PT',
  'GR',
  'RU',
  'UA',
  'PL',
  'RO',
  'BG',
  'SA',
  'AE',
  'QA',
  'KW',
  'IQ',
  'IR',
  'SY',
  'EG',
  'MA',
  'TN',
  'DZ',
  'PK',
  'IN',
  'BD',
  'ID',
  'MY',
  'PH',
  'TH',
  'VN',
  'KR',
  'JP',
  'CN',
  'BR',
  'MX',
  'AR',
  'CA',
  'AU',
  'NZ',
  'KZ',
  'UZ',
  'TM',
  'KG',
  'GE',
  'AM',
  'CY',
] as const;

/** Ülke görünen adı — önce i18n override, yoksa Intl.DisplayNames, son çare fallback. */
export function ulkeGorunenAd(
  code: string,
  fallbackName?: string | null,
): string {
  const cc = String(code ?? '')
    .trim()
    .toUpperCase();
  if (cc.length !== 2) {
    const fb = fallbackName?.trim();
    return fb || String(code ?? '');
  }

  const key = `kisilerUlke.${cc}`;
  const override = i18n.t(key, { defaultValue: '' });
  if (override && override !== key) return override;

  const locale = DIL_LOCALE_MAP[DilNormalizeEt(i18n.language)];
  for (const loc of [locale, 'en', 'tr']) {
    try {
      const dn = new Intl.DisplayNames([loc], { type: 'region' });
      const ad = dn.of(cc);
      // Hermes / eksik ICU bazen kodun kendisini döndürür — tam ad sayma
      if (ad && ad.toUpperCase() !== cc) return ad;
    } catch {
      /* DisplayNames yoksa sonraki locale / fallback */
    }
  }

  const fb = fallbackName?.trim();
  if (fb && fb.toUpperCase() !== cc) return fb;
  return cc;
}

/** Dil değişince yeniden hesaplanır — TR-only map bırakılmaz */
export function kisilerUlkeListesi(): { code: string; name: string }[] {
  return KISILER_ULKE_KODLARI.map((code) => ({
    code,
    name: ulkeGorunenAd(code),
  }));
}

/** Call-site alias — always fresh (language-aware) */
export function KISILER_ULKE_LISTESI(): { code: string; name: string }[] {
  return kisilerUlkeListesi();
}
