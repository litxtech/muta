import { Ionicons } from '@expo/vector-icons';
import type { Room } from '../../../types/models';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';

export type OdaModTanim = {
  kod: Room['mode'];
  ad: string;
  alt: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
};

export const ODA_MODLARI: OdaModTanim[] = [
  {
    kod: 'dating',
    ad: 'Flört',
    alt: 'Yakın sohbet & bağ',
    icon: 'heart',
    tint: RenkTokenlari.primary,
  },
  {
    kod: 'party',
    ad: 'Parti',
    alt: 'Enerji · kalabalık',
    icon: 'sparkles',
    tint: RenkTokenlari.magenta,
  },
  {
    kod: 'karaoke',
    ad: 'Karaoke',
    alt: 'Ses · sahne',
    icon: 'mic',
    tint: RenkTokenlari.violet,
  },
  {
    kod: 'game',
    ad: 'Oyun',
    alt: 'Rekabet · eğlence',
    icon: 'game-controller',
    tint: RenkTokenlari.mint,
  },
];

export function OdaModunuCoz(kod: Room['mode']): OdaModTanim {
  return ODA_MODLARI.find((m) => m.kod === kod) ?? ODA_MODLARI[0];
}
