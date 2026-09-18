/**
 * MUTA PAY takas anlaşması ödeme pencereleri.
 * Elmas çekimi (`CekimOdemeBilgisi`) ile karıştırılmaz.
 */

export const TAKAS_ODEME_PENCERELERI = ['01–15', '15–31'] as const;

export const TAKAS_ODEME_BILGISI =
  'İlk tamamlanan takas/anlaşma tarihinden itibaren ödemeler ayın 01–15 ve 15–31 pencerelerinde yapılır.';

export const TAKAS_IADE_UYARISI =
  'Mağaza iadesi, chargeback veya sahte dekont durumunda anlaşma iptal edilir, bakiye geri alınır ve hesap askıya alınabilir / kapatılabilir.';

export const TAKAS_DIL_NOTU =
  'Gösterilen tutarlar katalog değeri ve anlaşma özetidir; mağaza dışı nakit bozdurma değildir.';
