import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';

export type OdaTemaTanim = {
  kod: string;
  ad: string;
  alt: string;
  renkler: readonly [string, string, string];
  vurgu: string;
};

/**
 * Oda arka plan temaları — gradient sahne.
 * DB `room_themes.code` ile uyumlu; özel kapak yoksa sahne bunları kullanır.
 */
export const ODA_TEMALAR: OdaTemaTanim[] = [
  {
    kod: 'midnight_plum',
    ad: 'Gece eriği',
    alt: 'Mor gece sahnesi',
    renkler: ['#4A1A48', '#1E1230', '#0A0612'] as const,
    vurgu: RenkTokenlari.primary,
  },
  {
    kod: 'neon_aurora',
    ad: 'Neon aurora',
    alt: 'Pembe · magenta aurora',
    renkler: ['#5C1A5A', '#2E1848', '#100E1C'] as const,
    vurgu: RenkTokenlari.magenta,
  },
  {
    kod: 'royal_gold',
    ad: 'Kraliyet',
    alt: 'Altın VIP atmosfer',
    renkler: ['#4A3418', '#2A1C10', '#100C08'] as const,
    vurgu: RenkTokenlari.accent,
  },
  {
    kod: 'cosmic_void',
    ad: 'Kozmik',
    alt: 'Derin indigo boşluk',
    renkler: ['#1E1A58', '#121038', '#080814'] as const,
    vurgu: RenkTokenlari.violet,
  },
  {
    kod: 'arctic_mist',
    ad: 'Arktik',
    alt: 'Buz mavisi sis',
    renkler: ['#1A3A52', '#0E2438', '#060E18'] as const,
    vurgu: '#5EC8F0',
  },
  {
    kod: 'cherry_noir',
    ad: 'Kiraz noir',
    alt: 'Koyu kırmızı sahne',
    renkler: ['#4A1220', '#2A0C14', '#0E0608'] as const,
    vurgu: '#FF4D6D',
  },
  {
    kod: 'emerald_haze',
    ad: 'Zümrüt',
    alt: 'Orman yeşili pus',
    renkler: ['#0E3A32', '#0A2420', '#061210'] as const,
    vurgu: RenkTokenlari.mint,
  },
  {
    kod: 'sunset_pulse',
    ad: 'Gün batımı',
    alt: 'Turuncu · mercan nabız',
    renkler: ['#5A2818', '#301810', '#120A08'] as const,
    vurgu: '#FF7A45',
  },
  {
    kod: 'electric_lilac',
    ad: 'Elektrik',
    alt: 'Neon leylak parıltı',
    renkler: ['#3A1A68', '#201040', '#0C0818'] as const,
    vurgu: '#B794FF',
  },
  {
    kod: 'ocean_depth',
    ad: 'Okyanus',
    alt: 'Derin teal dalga',
    renkler: ['#0E2E48', '#0A1C30', '#060E18'] as const,
    vurgu: '#3DB8E8',
  },
  {
    kod: 'velvet_rose',
    ad: 'Kadife gül',
    alt: 'Yumuşak rose sahne',
    renkler: ['#4A2038', '#2A1424', '#100810'] as const,
    vurgu: '#F0A0C0',
  },
  {
    kod: 'cyber_mint',
    ad: 'Siber mint',
    alt: 'Koyu zemin · mint vurgu',
    renkler: ['#0E2E2A', '#0A1C1C', '#060E10'] as const,
    vurgu: '#3DFFC8',
  },
];

export function OdaTemasiniCoz(kod?: string | null): OdaTemaTanim {
  return ODA_TEMALAR.find((t) => t.kod === kod) ?? ODA_TEMALAR[0];
}
