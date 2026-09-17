import { RenkTokenlari } from './RenkTokenlari';
import { temaKodunuAl } from './tema/TemaDurumu';
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
  get tema() {
    const kod = temaKodunuAl();
    if (kod === 'acik') return 'light-premium' as const;
    if (kod === 'kadife') return 'velvet-rose' as const;
    if (kod === 'sampanya') return 'champagne-noir' as const;
    if (kod === 'kozmik') return 'cosmic-plum' as const;
    if (kod === 'zumrut') return 'emerald-vip' as const;
    return 'dark-premium' as const;
  },
};

export {
  RenkTokenlari,
  TipografiTokenlari,
  BoslukTokenlari,
  YaricapTokenlari,
  GolgeTokenlari,
  AnimasyonTokenlari,
};
