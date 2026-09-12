/**
 * Uyumluluk katmani — yeni kod `TasarimSistemi` kullanmali.
 */
import { RenkTokenlari } from '../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../tasarim-sistemi/BoslukVeYaricapTokenlari';

/** @deprecated yerine RenkTokenlari / TasarimSistemi */
export const colors = RenkTokenlari;
/** @deprecated */
export const typography = TipografiTokenlari;
/** @deprecated */
export const spacing = BoslukTokenlari;
/** @deprecated */
export const radii = YaricapTokenlari;
