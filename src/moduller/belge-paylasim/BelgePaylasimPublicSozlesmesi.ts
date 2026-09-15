/**
 * Belge paylaşım public sözleşmesi.
 * Diğer ekranlar sadece bu yüzey üzerinden PDF / yazıcı / WhatsApp kullanır.
 */
export type {
  BelgeIcerik,
  BelgeSatiri,
} from './BelgeSablonlari';

export {
  BelgeHtmlSablonOlustur,
  BelgeMetinOlustur,
} from './BelgeSablonlari';

export {
  PdfDosyasiOlustur,
  BelgeYazdir,
  BelgePdfPaylas,
  WhatsAppBelgeGonder,
  WhatsAppMetinGonder,
} from './BelgePaylasimIslemleri';

export {
  AdminOzetBelgesiOlustur,
  AdminCiroBelgesiOlustur,
  CuzdanHareketBelgesiOlustur,
} from './BelgeIcerikDonustur';

export const BELGE_PAYLASIM_MODUL_ADI = 'belge-paylasim' as const;
