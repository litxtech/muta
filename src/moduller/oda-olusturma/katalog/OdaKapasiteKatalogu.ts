export type OdaKapasiteTanim = {
  kod: string;
  ad: string;
  alt: string;
  dinleyici: number;
  mikrofon: number;
};

/** Kapasite katmanları — DB kodlarıyla uyumlu */
export const ODA_KAPASITELER: OdaKapasiteTanim[] = [
  {
    kod: 'mini',
    ad: 'Mini',
    alt: 'Samimi oda',
    dinleyici: 50,
    mikrofon: 6,
  },
  {
    kod: 'social',
    ad: 'Sosyal',
    alt: 'Günlük sohbet',
    dinleyici: 250,
    mikrofon: 10,
  },
  {
    kod: 'community',
    ad: 'Topluluk',
    alt: 'Topluluk sahnesi',
    dinleyici: 1000,
    mikrofon: 12,
  },
  {
    kod: 'stage',
    ad: 'Sahne',
    alt: 'Büyük sahne',
    dinleyici: 5000,
    mikrofon: 16,
  },
  {
    kod: 'event',
    ad: 'Etkinlik',
    alt: 'Etkinlik boyutu',
    dinleyici: 10000,
    mikrofon: 20,
  },
];

export function OdaKapasitesiniCoz(kod?: string | null): OdaKapasiteTanim {
  return ODA_KAPASITELER.find((k) => k.kod === kod) ?? ODA_KAPASITELER[1];
}
