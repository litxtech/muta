import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  DilNormalizeEt,
  VARSAYILAN_DIL,
  type UygulamaDili,
} from './diller';
import { tr } from './locales/tr';
import { en } from './locales/en';

/**
 * Yalnızca varsayılan iki dil giriş paketinde. Diğerleri seçilince `import()`
 * ile ayrı parça olarak iner (7 dil ≈ 1,8 MB kaynak; web giriş paketini
 * küçültmek için kritik).
 */
const DIL_YUKLEYICILERI: Record<
  string,
  () => Promise<Record<string, unknown>>
> = {
  es: () => import('./locales/es').then((m) => m.es as unknown as Record<string, unknown>),
  pt: () => import('./locales/pt').then((m) => m.pt as unknown as Record<string, unknown>),
  ar: () => import('./locales/ar').then((m) => m.ar as unknown as Record<string, unknown>),
  fr: () => import('./locales/fr').then((m) => m.fr as unknown as Record<string, unknown>),
  fil: () => import('./locales/fil').then((m) => m.fil as unknown as Record<string, unknown>),
};

const resources = {
  tr: { translation: tr },
  en: { translation: en },
} as const;

/**
 * İlk boyama: cihaz/ülke dili (senkron). AsyncStorage MANUAL dil yüklenene kadar
 * flash’ı azaltır. Kayıtlı MANUAL dil DilSaglayici’de await ile uygulanır.
 *
 * Not: CihazDiliniAl() burada çağrılmaz — HMR / circular import sırasında
 * named export undefined kalırsa TypeError: undefined is not a function olur.
 */
function baslangicDilAl(): UygulamaDili {
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

const BASLANGIC_DIL = baslangicDilAl();

/** init yalnızca pakette bulunan dillerle başlar; diğerleri await ile iner. */
const BASLANGIC_HAZIR_DIL: UygulamaDili =
  BASLANGIC_DIL === 'tr' || BASLANGIC_DIL === 'en' ? BASLANGIC_DIL : 'en';

/** init tamamlanmadan changeLanguage çağrılmasın */
export const i18nHazir = i18n.use(initReactI18next).init({
  resources,
  lng: BASLANGIC_HAZIR_DIL,
  fallbackLng: 'en',
  compatibilityJSON: 'v4',
  interpolation: { escapeValue: false },
  returnNull: false,
  parseMissingKeyHandler: (key) => {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('[i18n] Missing translation:', key);
    }
    const enVal = i18n.getResource('en', 'translation', key);
    return typeof enVal === 'string' ? enVal : '';
  },
});

/**
 * Seçilen dilin sözlüğünü (giriş paketinde değilse) indirip i18next'e ekler.
 * DilSaglayici hazır olmadan çocukları render etmez — dil değişimi görünmez.
 */
export async function DilKaynaginiYukle(dil: string): Promise<void> {
  const kod = DilNormalizeEt(dil);
  if (i18n.hasResourceBundle(kod, 'translation')) return;
  const yukle = DIL_YUKLEYICILERI[kod];
  if (!yukle) return;
  const sozluk = await yukle();
  if (!i18n.hasResourceBundle(kod, 'translation')) {
    i18n.addResourceBundle(kod, 'translation', sozluk, true, true);
  }
}

/**
 * Dil değişimini uygula — mutlaka await et.
 * Aksi halde UI İngilizce açılıp sonra düzelir (language flash).
 */
export async function I18nDiliniAyarla(dil: string): Promise<UygulamaDili> {
  const kod = DilNormalizeEt(dil);
  await i18nHazir;
  await DilKaynaginiYukle(kod);
  if (i18n.language !== kod && !i18n.language?.startsWith(`${kod}-`)) {
    await i18n.changeLanguage(kod);
  }
  return kod;
}

export function AktifDil(): UygulamaDili {
  return DilNormalizeEt(i18n.language);
}

export { isRtlDil, isRtlAktif } from './rtl';

export default i18n;
