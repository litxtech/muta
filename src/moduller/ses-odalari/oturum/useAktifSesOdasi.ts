import { useEffect, useState } from 'react';
import {
  AktifSesOdasiDinle,
  type AktifSesOdasiDurum,
} from './AktifSesOdasiOturumu';

/** Aktif ses odası oturumunu abone ol — mini bar / arka plan UI */
export function useAktifSesOdasi(): AktifSesOdasiDurum | null {
  const [durum, setDurum] = useState<AktifSesOdasiDurum | null>(null);
  useEffect(() => AktifSesOdasiDinle(setDurum), []);
  return durum;
}
