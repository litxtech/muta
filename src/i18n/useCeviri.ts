import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { CeviriSozlugu } from './locales/tr';
import { isRtlAktif, isRtlDil } from './rtl';
import { DilNormalizeEt } from './diller';

type NestedKeyOf<T, Prefix extends string = ''> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends object
        ? NestedKeyOf<T[K], `${Prefix}${K}.`>
        : `${Prefix}${K}`;
    }[keyof T & string]
  : never;

export type CeviriAnahtari = NestedKeyOf<CeviriSozlugu>;

/** Tip güvenli çeviri kancası + merkezi RTL bayrağı */
export function useCeviri() {
  const { t, i18n } = useTranslation();
  return useMemo(() => {
    const dil = DilNormalizeEt(i18n.language);
    return {
      t: (key: CeviriAnahtari, opts?: Record<string, unknown>) =>
        t(key, opts) as string,
      i18n,
      dil,
      rtl: isRtlDil(dil),
      rtlAktif: isRtlAktif(),
    };
  }, [t, i18n, i18n.language]);
}
