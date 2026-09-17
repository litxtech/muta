import { StyleSheet } from 'react-native';
import {
  paletiAl,
  temaKodunuAl,
  temaKodunuAnlikBirak,
  temaKodunuAnlikKur,
  type TemaKodu,
} from './TemaDurumu';

type NamedStyles<T> = StyleSheet.NamedStyles<T>;

const origCreate = StyleSheet.create.bind(StyleSheet);

export function orijinalStilOlustur<T extends NamedStyles<T> | NamedStyles<any>>(
  stiller: T,
): T {
  return origCreate(stiller);
}

/**
 * StyleSheet.create fabrikasi — her TemaKodu icin ayri kayit tutar.
 * Proxy, render aninda aktif temadaki stil ID'sini doner.
 */
export function temaliStil<T extends NamedStyles<T> | NamedStyles<any>>(
  factory: () => T,
): T {
  const cache: Partial<Record<TemaKodu, T>> = {};

  const sheet = (kod: TemaKodu): T => {
    const mevcut = cache[kod];
    if (mevcut) return mevcut;
    temaKodunuAnlikKur(kod);
    try {
      void paletiAl();
      const created = origCreate(factory()) as T;
      cache[kod] = created;
      return created;
    } finally {
      temaKodunuAnlikBirak();
    }
  };

  return new Proxy({} as T, {
    get(_t, prop) {
      const s = sheet(temaKodunuAl()) as Record<string | symbol, unknown>;
      return s[prop];
    },
    ownKeys() {
      return Reflect.ownKeys(sheet(temaKodunuAl()) as object);
    },
    getOwnPropertyDescriptor(_t, prop) {
      return Object.getOwnPropertyDescriptor(
        sheet(temaKodunuAl()) as object,
        prop,
      );
    },
    has(_t, prop) {
      return prop in (sheet(temaKodunuAl()) as object);
    },
  });
}

export function stilYamasiniUygula(): void {
  const yamali = StyleSheet as typeof StyleSheet & { __tamusoTemali?: boolean };
  if (yamali.__tamusoTemali) return;
  yamali.__tamusoTemali = true;

  StyleSheet.create = ((stillerVeyaFabrika: unknown) => {
    if (typeof stillerVeyaFabrika === 'function') {
      return temaliStil(stillerVeyaFabrika as () => NamedStyles<any>);
    }
    return origCreate(stillerVeyaFabrika as any);
  }) as typeof StyleSheet.create;
}
