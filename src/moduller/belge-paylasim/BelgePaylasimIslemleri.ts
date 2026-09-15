import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import {
  BelgeHtmlSablonOlustur,
  BelgeMetinOlustur,
  type BelgeIcerik,
} from './BelgeSablonlari';

export type BelgeIslemSonucu =
  | { ok: true; uri?: string }
  | { ok: false; hata: string };

async function PrintModulu() {
  try {
    return await import('expo-print');
  } catch {
    return null;
  }
}

async function SharingModulu() {
  try {
    return await import('expo-sharing');
  } catch {
    return null;
  }
}

/** HTML → PDF dosyası (cache) */
export async function PdfDosyasiOlustur(
  icerik: BelgeIcerik,
): Promise<BelgeIslemSonucu> {
  try {
    const Print = await PrintModulu();
    if (!Print) {
      return {
        ok: false,
        hata: 'PDF icin yeni native build gerekli (expo-print)',
      };
    }
    const html = BelgeHtmlSablonOlustur(icerik);
    const { uri } = await Print.printToFileAsync({ html });
    return { ok: true, uri };
  } catch (e) {
    return {
      ok: false,
      hata: e instanceof Error ? e.message : 'PDF olusturulamadi',
    };
  }
}

/** Sistem yazıcı diyaloğu */
export async function BelgeYazdir(icerik: BelgeIcerik): Promise<BelgeIslemSonucu> {
  try {
    const Print = await PrintModulu();
    if (!Print) {
      return {
        ok: false,
        hata: 'Yazdirma icin yeni native build gerekli (expo-print)',
      };
    }
    const html = BelgeHtmlSablonOlustur(icerik);
    await Print.printAsync({ html });
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      hata: e instanceof Error ? e.message : 'Yazdirma baslatilamadi',
    };
  }
}

/** PDF oluştur + genel paylaşım (WhatsApp dahil) */
export async function BelgePdfPaylas(
  icerik: BelgeIcerik,
): Promise<BelgeIslemSonucu> {
  const pdf = await PdfDosyasiOlustur(icerik);
  if (!pdf.ok || !pdf.uri) return pdf;

  try {
    const Sharing = await SharingModulu();
    if (!Sharing) {
      return { ok: false, hata: 'Paylasim modulu yuklenemedi' };
    }
    const uygun = await Sharing.isAvailableAsync();
    if (!uygun) {
      return { ok: false, hata: 'Paylasim bu cihazda desteklenmiyor' };
    }
    await Sharing.shareAsync(pdf.uri, {
      mimeType: 'application/pdf',
      dialogTitle: icerik.baslik,
      UTI: 'com.adobe.pdf',
    });
    return { ok: true, uri: pdf.uri };
  } catch (e) {
    return {
      ok: false,
      hata: e instanceof Error ? e.message : 'Paylasim basarisiz',
    };
  }
}

/**
 * WhatsApp'a gönder.
 * Önce PDF + paylaşım paneli; metin derin bağlantısı yedek.
 */
export async function WhatsAppBelgeGonder(
  icerik: BelgeIcerik,
  telefonE164?: string | null,
): Promise<BelgeIslemSonucu> {
  const metin = BelgeMetinOlustur(icerik);
  const pdf = await PdfDosyasiOlustur(icerik);

  if (pdf.ok && pdf.uri) {
    try {
      const Sharing = await SharingModulu();
      if (Sharing) {
        const uygun = await Sharing.isAvailableAsync();
        if (uygun) {
          await Sharing.shareAsync(pdf.uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'WhatsApp ile gönder',
            UTI: 'com.adobe.pdf',
          });
          return { ok: true, uri: pdf.uri };
        }
      }
    } catch {
      // metin yoluna düş
    }
  }

  const tel = (telefonE164 ?? '').replace(/[^\d]/g, '');
  const encoded = encodeURIComponent(metin);
  const url = tel
    ? `https://wa.me/${tel}?text=${encoded}`
    : Platform.select({
        ios: `whatsapp://send?text=${encoded}`,
        android: `whatsapp://send?text=${encoded}`,
        default: `https://wa.me/?text=${encoded}`,
      })!;

  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
      return { ok: true };
    }
    await Linking.openURL(`https://wa.me/${tel ? tel : ''}?text=${encoded}`);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      hata: e instanceof Error ? e.message : 'WhatsApp acilamadi',
    };
  }
}

/** Sadece metin WhatsApp */
export async function WhatsAppMetinGonder(
  metin: string,
  telefonE164?: string | null,
): Promise<BelgeIslemSonucu> {
  const tel = (telefonE164 ?? '').replace(/[^\d]/g, '');
  const encoded = encodeURIComponent(metin);
  const url = tel
    ? `https://wa.me/${tel}?text=${encoded}`
    : `whatsapp://send?text=${encoded}`;
  try {
    await Linking.openURL(url);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      hata: e instanceof Error ? e.message : 'WhatsApp acilamadi',
    };
  }
}
