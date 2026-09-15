/**
 * Paylaşım linkleri — public sözleşme.
 * Kullanıcı paylaşır → indirme yönlendirmesi; admin CRUD.
 */
export type {
  AppPaylasimLinki,
  KullaniciDavetKodu,
  PaylasimLinkGirdi,
  PaylasimPlatform,
} from './tipler';

export {
  PaylasimHttpsUrlOlustur,
  PaylasimDeepLinkOlustur,
  PaylasimMesajiOlustur,
} from './PaylasimUrl';

export { UygulamayiPaylas } from './islemler/UygulamayiPaylas';
export { BenimDavetKodumuAl } from './okuma/DavetKodunuAl';

export const PAYLASIM_LINKLERI_MODUL_ADI = 'paylasim-linkleri' as const;
