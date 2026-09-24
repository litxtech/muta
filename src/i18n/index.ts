import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DilNormalizeEt, VARSAYILAN_DIL, type UygulamaDili } from './diller';
import { tr } from './locales/tr';
import { en } from './locales/en';
import { es } from './locales/es';
import { ar } from './locales/ar';

const resources = {
  tr: { translation: tr },
  en: { translation: en },
  es: { translation: es },
  ar: { translation: ar },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: VARSAYILAN_DIL,
  fallbackLng: 'en',
  compatibilityJSON: 'v4',
  interpolation: { escapeValue: false },
  returnNull: false,
  parseMissingKeyHandler: (key) => {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('[i18n] Missing translation:', key);
    }
    // production: never show raw key — try en, else empty
    const enVal = i18n.getResource('en', 'translation', key);
    return typeof enVal === 'string' ? enVal : '';
  },
});

export function I18nDiliniAyarla(dil: string): UygulamaDili {
  const kod = DilNormalizeEt(dil);
  if (i18n.language !== kod) {
    void i18n.changeLanguage(kod);
  }
  return kod;
}

export function AktifDil(): UygulamaDili {
  return DilNormalizeEt(i18n.language);
}

export { isRtlDil, isRtlAktif } from './rtl';

export default i18n;
