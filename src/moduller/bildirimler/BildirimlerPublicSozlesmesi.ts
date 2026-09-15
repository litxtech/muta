/**
 * Bildirimler public sözleşme.
 * Gelen kutu + okundu sayacı + token kaydı + tercihler.
 */
export { CihazPushTokeniniKaydet } from './kayit/CihazPushTokeniniKaydet';
export {
  AndroidFcmTokeniniAl,
  ExpoPushTokeniniAl,
} from './kayit/ExpoPushTokeniniAl';
export {
  PushTercihleriniGetir,
  PushTercihiniKaydet,
  PushTercihleriniTopluKaydet,
} from './tercihler/PushTercihleriniYonet';
export {
  PUSH_TERCIH_KATALOGU,
  type PushTercihleri,
  type PushTercihAnahtari,
} from './tercihler/PushTercihTipleri';
export {
  BildirimlerimiListele,
  BildirimOkunmamisSayim,
  BildirimleriHepsiniOkundu,
  BildirimOkunduIsaretle,
} from './okuma/BildirimKuyrugumuGetir';
export { BildirimHedefYolu, BildirimTarihSaat } from './islemler/BildirimHedefYolu';
export { BildirimSaglayici, useBildirimler } from './baglam/BildirimSaglayici';
export { BildirimZiliDugmesi } from './bilesenler/BildirimZiliDugmesi';

export const BILDIRIMLER_MODUL_ADI = 'bildirimler' as const;
