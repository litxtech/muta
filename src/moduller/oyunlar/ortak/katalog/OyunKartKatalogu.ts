/**
 * Oyun kart kataloğu — feed / lobi kartlarının görsel kimliği tek yerde.
 * Yeni oyun eklenince buraya bir kayıt düşer; UI otomatik kartlaşır.
 */

import type { ImageSourcePropType } from 'react-native';
import { GAME_DISPLAY_NAME as KASKAD_NAME } from '../../kaskad/sabitler/KaskadSabitleri';
import {
  BackgroundImages as KaskadBg,
  CharacterImages as KaskadCharacter,
  SymbolImages as KaskadSymbols,
} from '../../kaskad/assets/VisualAssets';
import { GAME_DISPLAY_NAME as ZEUS_NAME } from '../../zeus/config/ZeusSabitleri';
import {
  CharacterImages as ZeusCharacter,
  SymbolImages as ZeusSymbols,
  UiImages as ZeusUi,
} from '../../zeus/assets/VisualAssets';
import { GAME_DISPLAY_NAME as NOX_NAME } from '../../slot/sabitler/SlotAyarlari';
import {
  BackgroundImages as NoxBg,
  SymbolImages as NoxSymbols,
  UiImages as NoxUi,
} from '../../slot/assets/VisualAssets';
import type { GameCode } from '../tipler/OyunTipleri';

export type OyunKartKimligi = {
  kod: GameCode;
  /** Ekran adı */
  baslik: string;
  /** Küçük üst etiket */
  eyebrow: string;
  /** Tek satır slogan */
  slogan: string;
  /** Kart arka planı */
  kapak: ImageSourcePropType;
  /** Karakter (sağ altta yüzer) */
  karakter: ImageSourcePropType;
  /** Kartta yüzen 4 sembol */
  semboller: readonly [
    ImageSourcePropType,
    ImageSourcePropType,
    ImageSourcePropType,
    ImageSourcePropType,
  ];
  /** Aura halkası renkleri */
  aura: readonly [string, string, string];
  /** CTA degrade */
  cta: readonly [string, string];
  /** Bağımsız oyun rotası */
  href: string;
};

export const OYUN_KART_KATALOGU: Record<
  'zeus' | 'kozmik_kaskad' | 'nox_reels',
  OyunKartKimligi
> = {
  zeus: {
    kod: 'zeus',
    baslik: ZEUS_NAME,
    eyebrow: 'OLYMPUS',
    slogan: 'Çarpan küreleri · 15 ücretsiz tur',
    kapak: ZeusUi.cover,
    karakter: ZeusCharacter.zeusIdle,
    semboller: [
      ZeusSymbols.goldCrown,
      ZeusSymbols.redRuby,
      ZeusSymbols.multiplierOrb,
      ZeusSymbols.pegasus,
    ],
    aura: ['#FFE08A', '#E8C547', '#4DA8FF'],
    cta: ['#FFD86B', '#C9861A'],
    href: '/oyun/zeus',
  },
  kozmik_kaskad: {
    kod: 'kozmik_kaskad',
    baslik: KASKAD_NAME,
    eyebrow: 'FIRTINA DİYARI',
    slogan: 'Portal scatter · kaskad zincirleri',
    kapak: KaskadBg.stormSky,
    karakter: KaskadCharacter.stormKeeper,
    semboller: [
      KaskadSymbols.energyCrown,
      KaskadSymbols.purpleCrystal,
      KaskadSymbols.stormMultiplier,
      KaskadSymbols.portalScatter,
    ],
    aura: ['#A78BFA', '#6FE3FF', '#F0B429'],
    cta: ['#8B5CF6', '#4C1D95'],
    href: '/oyun/kaskad',
  },
  nox_reels: {
    kod: 'nox_reels',
    baslik: NOX_NAME,
    eyebrow: 'NIGHT SLOT',
    slogan: '5×3 payline · wild · scatter bonus',
    kapak: NoxUi.cover,
    karakter: NoxSymbols.SCATTER,
    semboller: [
      NoxSymbols.DIAMOND,
      NoxSymbols.ROYAL_CROWN,
      NoxSymbols.WILD,
      NoxSymbols.SCATTER,
    ],
    aura: ['#B794F6', '#FFE08A', '#6FE3FF'],
    cta: ['#7C3AED', '#1E1B4B'],
    href: '/oyun/nox',
  },
};

export function oyunKartKimligi(kod: GameCode): OyunKartKimligi | null {
  if (kod === 'zeus') return OYUN_KART_KATALOGU.zeus;
  if (kod === 'kozmik_kaskad') return OYUN_KART_KATALOGU.kozmik_kaskad;
  if (kod === 'nox_reels') return OYUN_KART_KATALOGU.nox_reels;
  return null;
}

/** Feed sırası — Zeus, NOX, Kaskad; bilinmeyen kodlar atlanır */
export function feedOyunKartlari(kodlar: readonly GameCode[]): OyunKartKimligi[] {
  const sira: Array<'zeus' | 'nox_reels' | 'kozmik_kaskad'> = [
    'zeus',
    'nox_reels',
    'kozmik_kaskad',
  ];
  return sira
    .filter((k) => kodlar.includes(k))
    .map((k) => OYUN_KART_KATALOGU[k]);
}
