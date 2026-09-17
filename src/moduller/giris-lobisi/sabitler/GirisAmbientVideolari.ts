/**
 * Giriş lobisi ambient video — gerçek insan stok klipleri (Mixkit Free License).
 * Auth giriş ekranında arka planda sessiz döngü.
 */

export type GirisAmbientKaynak = {
  id: string;
  kaynak: number;
  etiket: string;
};

export const GIRIS_AMBIENT_VIDEOLARI: GirisAmbientKaynak[] = [
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
