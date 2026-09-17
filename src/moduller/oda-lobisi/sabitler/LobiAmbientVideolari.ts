/**
 * @deprecated Giriş lobisi videosu `giris-lobisi/sabitler/GirisAmbientVideolari` altında.
 * Geriye uyumluluk için tutuluyor.
 */

export type LobiAmbientKaynak = {
  id: string;
  kaynak: number;
  etiket: string;
};

export const LOBI_AMBIENT_VIDEOLARI: LobiAmbientKaynak[] = [
  {
    id: 'cafe-ikili',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    kaynak: require('../../../../assets/videos/lobi/cafe-ikili.mp4'),
    etiket: 'Kafe sohbeti',
  },
  {
    id: 'cafe-sohbet',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    kaynak: require('../../../../assets/videos/lobi/cafe-sohbet.mp4'),
    etiket: 'Arkadaş sohbeti',
  },
  {
    id: 'cafe-gulme',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    kaynak: require('../../../../assets/videos/lobi/cafe-gulme.mp4'),
    etiket: 'Canlı ortam',
  },
];
