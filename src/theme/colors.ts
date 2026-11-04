/**
 * Uyumluluk katmani — yeni kod dogrudan `src/tasarim-sistemi` tokenlarini kullanmali.
 */
import { RenkTokenlari } from '../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../tasarim-sistemi/BoslukVeYaricapTokenlari';

/** @deprecated yerine RenkTokenlari */
export const colors = RenkTokenlari;
/** @deprecated */
export const typography = TipografiTokenlari;
/** @deprecated */
export const spacing = BoslukTokenlari;
/** @deprecated */
export const radii = YaricapTokenlari;
