import { RenkTokenlari } from './RenkTokenlari';
import { TipografiTokenlari } from './TipografiTokenlari';
import {
  AnimasyonTokenlari,
  BoslukTokenlari,
  GolgeTokenlari,
  YaricapTokenlari,
} from './BoslukVeYaricapTokenlari';

/**
 * Design System public export.
 * Eski `src/theme/colors` uyumluluk katmani buraya baglanir.
 */
export const TasarimSistemi = {
  renkler: RenkTokenlari,
  tipografi: TipografiTokenlari,
  bosluklar: BoslukTokenlari,
  yaricaplar: YaricapTokenlari,
  golgeler: GolgeTokenlari,
  animasyonlar: AnimasyonTokenlari,
  tema: 'dark-premium' as const,
};

export {
  RenkTokenlari,
  TipografiTokenlari,
  BoslukTokenlari,
  YaricapTokenlari,
  GolgeTokenlari,
  AnimasyonTokenlari,
};
