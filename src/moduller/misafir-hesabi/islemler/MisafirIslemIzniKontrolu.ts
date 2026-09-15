/**
 * Guest state-changing islem izni.
 * Client kontrol UX icindir; backend yine dogrular.
 */
export type MisafirEngelliIslem =
  | 'mesaj_gonder'
  | 'hediye_gonder'
  | 'coin_satinal'
  | 'takip_et'
  | 'yorum_yap'
  | 'durum_paylas'
  | 'mikrofon'
  | 'canli_ac'
  | 'oda_olustur'
  | 'ajans_olustur'
  | 'oy_kullan'
  | 'cekim'
  | 'destek'
  | 'pk_baslat'
  | 'oyun_baslat';

const ENGELLI: Record<MisafirEngelliIslem, true> = {
  mesaj_gonder: true,
  hediye_gonder: true,
  coin_satinal: true,
  takip_et: true,
  yorum_yap: true,
  durum_paylas: true,
  mikrofon: true,
  canli_ac: true,
  oda_olustur: true,
  ajans_olustur: true,
  oy_kullan: true,
  cekim: true,
  destek: true,
  pk_baslat: true,
  oyun_baslat: true,
};

export function MisafirIslemIzniVarMi(
  isGuest: boolean,
  islem: MisafirEngelliIslem,
): boolean {
  if (!isGuest) return true;
  return !ENGELLI[islem];
}

export function MisafirIslemEngellendiMi(
  isGuest: boolean,
  islem: MisafirEngelliIslem,
): boolean {
  return !MisafirIslemIzniVarMi(isGuest, islem);
}
