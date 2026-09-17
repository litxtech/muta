export type SehirlerPublicSozlesmesi = {
  sehirDestekle: (input: {
    cityId: string;
    isPrimary?: boolean;
  }) => Promise<{ ok: boolean; hata?: string }>;
};

export const SEHIRLER_MODUL_ADI = 'sehirler' as const;

export { SehirDestekle } from './islemler/SehirDestekle';
export { SehirDestekGeriCek } from './islemler/SehirDestekGeriCek';
export { SehirleriGetir, type GeoSehir } from './okuma/SehirleriGetir';
export {
  DesteklenenSehirleriGetir,
  AnaSehirGetir,
  type DesteklenenSehir,
} from './okuma/DesteklenenSehirleriGetir';
export { SehirDetayGetir, type SehirDetayOzeti } from './okuma/SehirDetayGetir';
export {
  ResmiSehirOdalariniGetir,
  SehirRolleriniGetir,
  type ResmiSehirOdasi,
} from './okuma/ResmiSehirOdalariniGetir';
