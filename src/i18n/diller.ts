/** Desteklenen arayüz dilleri + locale çözümleme. */

export const DESTEKLENEN_DILLER = ['tr', 'en', 'es', 'ar'] as const;

export type UygulamaDili = (typeof DESTEKLENEN_DILLER)[number];

/** SYSTEM = cihaz dili; MANUAL = kullanıcı sabitledi — restart’ta değişmez */
export type DilModu = 'SYSTEM' | 'MANUAL';

/** Runtime fallback — eksik/desteklenmeyen dil → English (Türkçe değil) */
export const VARSAYILAN_DIL: UygulamaDili = 'en';

export const DIL_ETIKETLERI: Record<UygulamaDili, string> = {
  tr: 'Türkçe',
  en: 'English',
  es: 'Español',
  ar: 'العربية',
};

export const DIL_LOCALE_MAP: Record<UygulamaDili, string> = {
  tr: 'tr-TR',
  en: 'en-US',
  es: 'es-ES',
  ar: 'ar',
};

export function DilDestekleniyorMu(kod: string | null | undefined): boolean {
  if (!kod) return false;
  const k = kod.trim().toLowerCase().slice(0, 2);
  return (DESTEKLENEN_DILLER as readonly string[]).includes(k);
}

/**
 * Cihaz/kayıtlı locale → desteklenen dil.
 * tr-* → tr, en-* → en, es-* → es, ar-* → ar
 * diğer her şey → en
 */
export function DilNormalizeEt(raw: string | null | undefined): UygulamaDili {
  if (!raw) return VARSAYILAN_DIL;
  const kod = raw.trim().toLowerCase().replace('_', '-');
  const primary = kod.split('-')[0] ?? '';
  if ((DESTEKLENEN_DILLER as readonly string[]).includes(primary)) {
    return primary as UygulamaDili;
  }
  return VARSAYILAN_DIL;
}

/** Cihaz dili — Intl (native ExpoLocalization yoksa da çalışır). */
export function CihazDiliniAl(): UygulamaDili {
  try {
    const tag =
      typeof Intl !== 'undefined'
        ? Intl.DateTimeFormat().resolvedOptions().locale
        : '';
    if (tag) return DilNormalizeEt(tag);
  } catch {
    /* Intl yok / bozuk */
  }
  return VARSAYILAN_DIL;
}

/**
 * Öncelik:
 * 1. MANUAL + kayıtlı dil → o dil (kilitle)
 * 2. SYSTEM → cihaz dili (desteklenmiyorsa en)
 * 3. en
 */
export function DilCozumle(input: {
  mod: DilModu;
  manuelDil?: string | null;
  profilDili?: string | null;
}): UygulamaDili {
  if (input.mod === 'MANUAL' && input.manuelDil) {
    return DilNormalizeEt(input.manuelDil);
  }
  // SYSTEM: cihaz; profil sadece ipucu değil — SYSTEM’te cihaz öncelikli
  return CihazDiliniAl();
}
