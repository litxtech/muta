/**
 * Ses odasi fullScreenModal cikis.
 *
 * Hedef kok stack'teki `(tabs)` olmali. `/(tabs)/index` Expo Router 57'de
 * unmatched route uretir: app/index.tsx `/` yolunu tutar, dismissTo da
 * stack'te bulamazsa mevcut ekrani o href ile degistirir (host replace
 * ile oda acinca (tabs) altta kalmaz).
 *
 * dismissTo: hedef stack'teyse pop, yoksa replace — zincir navigate yok.
 */
import { router, type Href } from 'expo-router';
import {
  OdaCikisKilidiniAc,
  OdaCikisKilidiniKapat,
} from './OdaCikisKilidi';

const ODA_CIKIS_HEDEFI = '/(tabs)' as Href;

export function OdadanCikisYonlendir(hedef: Href = ODA_CIKIS_HEDEFI) {
  OdaCikisKilidiniAc();
  try {
    router.dismissTo(hedef);
  } catch {
    try {
      router.replace(hedef);
    } catch {
      /* ignore */
    }
  }
  setTimeout(() => OdaCikisKilidiniKapat(), 900);
}
