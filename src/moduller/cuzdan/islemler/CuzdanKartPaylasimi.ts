import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { CuzdanNoQrPayload } from '../takas/CuzdanTakasIslemleri';
import {
  MesajGonder,
  OzelSohbetAcVeyaGetir,
} from '../../mesajlasma/islemler/MesajGonder';

function formatCuzdanNo(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 18);
  return d.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

function yeniUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** QR / alıcı önizleme: yalnızca ad ve soyadın ilk harfi */
export function CuzdanAdSoyadMaskele(
  first?: string | null,
  last?: string | null,
): string {
  const a = (first ?? '').trim();
  const b = (last ?? '').trim();
  const ha = a ? `${a.charAt(0).toLocaleUpperCase('tr-TR')}.` : '';
  const hb = b ? `${b.charAt(0).toLocaleUpperCase('tr-TR')}.` : '';
  const out = [ha, hb].filter(Boolean).join(' ');
  return out || '—';
}

export function CuzdanNoQrGorselUri(
  walletNumber: string,
  size = 320,
): string {
  const payload = CuzdanNoQrPayload(walletNumber);
  // Yüksek kontrast + margin — modern banka QR plakası
  const params = new URLSearchParams({
    size: `${size}x${size}`,
    data: payload,
    color: '1A0A12',
    bgcolor: 'FFFEFB',
    margin: '14',
    qzone: '2',
    format: 'png',
  });
  return `https://api.qrserver.com/v1/create-qr-code/?${params.toString()}`;
}

export function CuzdanKartPaylasimMetni(walletNumber: string): string {
  const no = walletNumber.replace(/\D/g, '');
  const payload = CuzdanNoQrPayload(no);
  return [
    'MUTA PAY cüzdanım',
    formatCuzdanNo(no),
    '',
    `Bağlantı: ${payload}`,
    'Ses odası, gönderi, mesaj ve canlı yayın aktiviteleri için dijital cüzdan.',
    'Uygulamada Takas / QR ile okutabilirsin.',
  ].join('\n');
}

/** Uygulama içi mesaj: cüzdan kartı paylaş */
export async function CuzdanKartiniMesajlaPaylas(input: {
  otherUserId: string;
  walletNumber: string;
}): Promise<{ ok: true; threadId: string } | { ok: false; hata: string }> {
  const no = input.walletNumber.replace(/\D/g, '');
  if (no.length !== 18) {
    return { ok: false, hata: 'Cüzdan numarası hazır değil.' };
  }
  const sohbet = await OzelSohbetAcVeyaGetir(input.otherUserId);
  if (!sohbet.ok) return sohbet;

  const body = CuzdanKartPaylasimMetni(no);
  const qrUrl = CuzdanNoQrGorselUri(no, 240);

  // Metin — client_id UUID olmalı (mesaj_gonder uuid bekler)
  const msg = await MesajGonder({
    threadId: sohbet.threadId,
    body,
    clientId: yeniUuid(),
  });
  if (!msg.ok) return { ok: false, hata: msg.hata };

  // QR görseli — başarısız olsa metin yeterli
  const img = await MesajGonder({
    threadId: sohbet.threadId,
    body: 'Cüzdan QR',
    messageType: 'image',
    mediaUrl: qrUrl,
    clientId: yeniUuid(),
  });
  if (!img.ok) {
    // Harici QR URL bazı ortamlarda reddedilebilir; metin zaten gitti
    console.warn('[CuzdanKartPaylas] QR mesaj:', img.hata);
  }

  return { ok: true, threadId: sohbet.threadId };
}

/**
 * WhatsApp: QR görseli + metin.
 * Görsel paylaşılamazsa metin (no + deep link + QR URL) gönderilir.
 */
export async function CuzdanKartiniWhatsAppPaylas(
  walletNumber: string,
): Promise<{ ok: true } | { ok: false; hata: string }> {
  const no = walletNumber.replace(/\D/g, '');
  if (no.length !== 18) {
    return { ok: false, hata: 'Cüzdan numarası hazır değil.' };
  }

  const metin = CuzdanKartPaylasimMetni(no);
  const qrRemote = CuzdanNoQrGorselUri(no, 400);

  try {
    const FS = await import('expo-file-system/legacy');
    const Sharing = await import('expo-sharing');
    if (FS.cacheDirectory && (await Sharing.isAvailableAsync())) {
      const yerel = `${FS.cacheDirectory}mutapay_cuzdan_qr_${no.slice(-6)}.png`;
      const indir = await FS.downloadAsync(qrRemote, yerel);
      if (indir?.uri) {
        await Sharing.shareAsync(indir.uri, {
          mimeType: 'image/png',
          dialogTitle: 'WhatsApp ile cüzdan QR paylaş',
          UTI: 'public.png',
        });
        return { ok: true };
      }
    }
  } catch {
    /* metin yedeği */
  }

  const encoded = encodeURIComponent(`${metin}\n\nQR: ${qrRemote}`);
  const url = Platform.select({
    ios: `whatsapp://send?text=${encoded}`,
    android: `whatsapp://send?text=${encoded}`,
    default: `https://wa.me/?text=${encoded}`,
  })!;

  try {
    const can = await Linking.canOpenURL(url);
    if (can) {
      await Linking.openURL(url);
      return { ok: true };
    }
    await Linking.openURL(`https://wa.me/?text=${encoded}`);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      hata: e instanceof Error ? e.message : 'WhatsApp açılamadı',
    };
  }
}
