import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';

export type OdaTemaTanim = {
  kod: string;
  ad: string;
  alt: string;
  renkler: readonly [string, string, string];
  vurgu: string;
};

/** Tema kodları — DB room_themes ile uyumlu */
export const ODA_TEMALAR: OdaTemaTanim[] = [
  {
    kod: 'midnight_plum',
    ad: 'Gece eriği',
    alt: 'Gece erik tonları',
    renkler: ['#3A1838', '#1A1024', '#0E0A14'] as const,
    vurgu: RenkTokenlari.primary,
  },
  {
    kod: 'neon_aurora',
    ad: 'Neon aurora',
    alt: 'Pembe · magenta aurora',
    renkler: ['#4A1A48', '#2A1840', '#12101C'] as const,
    vurgu: RenkTokenlari.magenta,
  },
  {
    kod: 'royal_gold',
    ad: 'Kraliyet altını',
    alt: 'Altın VIP atmosfera',
    renkler: ['#3A2A14', '#241810', '#120E0A'] as const,
    vurgu: RenkTokenlari.accent,
  },
  {
    kod: 'cosmic_void',
    ad: 'Kozmik boşluk',
    alt: 'Kozmik derin boşluk',
    renkler: ['#1A1840', '#121028', '#0A0A14'] as const,
    vurgu: RenkTokenlari.violet,
  },
];

export function OdaTemasiniCoz(kod?: string | null): OdaTemaTanim {
  return ODA_TEMALAR.find((t) => t.kod === kod) ?? ODA_TEMALAR[0];
}
