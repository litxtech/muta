/**
 * Ses odasından çıkış sırasında alttaki lobi focus alınca
 * yeniden yükleme / otomatik odaya sokma çalışmasın.
 */
let aktif = false;

export function OdaCikisKilidiniAc() {
  aktif = true;
}

export function OdaCikisKilidiniKapat() {
  aktif = false;
}

export function OdaCikisKilidiAktifMi() {
  return aktif;
}
