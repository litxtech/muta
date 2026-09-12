export type OdaDuzenKodu =
  | 'floating_glass'
  | 'aurora_stage'
  | 'orbit'
  | 'royal_lounge'
  | 'cosmic'
  | 'minimal_stage';

export type OdaDuzenTanim = {
  kod: OdaDuzenKodu;
  ad: string;
  kolon: number;
  halo: boolean;
  sahneOdakli: boolean;
};

const DUZENLER: Record<OdaDuzenKodu, OdaDuzenTanim> = {
  floating_glass: {
    kod: 'floating_glass',
    ad: 'Floating Glass',
    kolon: 4,
    halo: true,
    sahneOdakli: false,
  },
  aurora_stage: {
    kod: 'aurora_stage',
    ad: 'Aurora Stage',
    kolon: 3,
    halo: true,
    sahneOdakli: true,
  },
  orbit: {
    kod: 'orbit',
    ad: 'Orbit',
    kolon: 4,
    halo: true,
    sahneOdakli: false,
  },
  royal_lounge: {
    kod: 'royal_lounge',
    ad: 'Royal Lounge',
    kolon: 3,
    halo: true,
    sahneOdakli: true,
  },
  cosmic: {
    kod: 'cosmic',
    ad: 'Cosmic',
    kolon: 4,
    halo: true,
    sahneOdakli: false,
  },
  minimal_stage: {
    kod: 'minimal_stage',
    ad: 'Minimal Stage',
    kolon: 2,
    halo: false,
    sahneOdakli: true,
  },
};

/** Klasik 8 yuvarlak koltuk sabit tasarimi yok — Layout Engine */
export function OdaDuzeniniCoz(kod?: string | null): OdaDuzenTanim {
  if (kod && kod in DUZENLER) return DUZENLER[kod as OdaDuzenKodu];
  return DUZENLER.floating_glass;
}

export function OdaDuzenListesiniGetir(): OdaDuzenTanim[] {
  return Object.values(DUZENLER);
}
