/**
 * MUTA PAY takas hesap özeti metinleri.
 * Elmas çekimi (`CekimOdemeBilgisi`) ile karıştırılmaz.
 * Dil: Apple incelemesi — kumar / nakit bozdurma ima etmez.
 */

export const TAKAS_ODEME_PENCERELERI = ['01–15', '15–31'] as const;

export const TAKAS_ODEME_BILGISI =
  'Hesap hareketleri ayın 01–15 ve 15–31 dönemlerinde işlenir.';

export const TAKAS_IADE_UYARISI =
  'Mağaza iadesi veya usulsüz işlemde ilgili hareket iptal edilebilir; bakiye düzeltilir ve hesap kısıtlanabilir.';

export const TAKAS_DIL_NOTU =
  'Gösterilen tutarlar uygulama içi sanal öğe katalog özetidir; gerçek para ödemesi değildir.';
