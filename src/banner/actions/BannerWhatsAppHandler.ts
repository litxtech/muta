import { Linking, Alert, Platform } from 'react-native';
import type { BannerAction } from '../core/BannerTypes';

function normalizePhone(raw: string): string {
  return raw.replace(/[^\d]/g, '');
}

export async function handleWhatsApp(
  action: BannerAction,
): Promise<{ ok: boolean; error?: string }> {
  const payload = action.payload_json ?? {};
  const phone = normalizePhone(
    String(payload.phoneNumber ?? payload.phone ?? action.target ?? ''),
  );
  const message = String(
    payload.message ?? action.url ?? 'Merhaba, Tamuso üzerinden ulaşıyorum.',
  );

  if (!phone) {
    Alert.alert('WhatsApp', 'Telefon numarası tanımlı değil.');
    return { ok: false, error: 'no_phone' };
  }

  const encoded = encodeURIComponent(message);
  const appUrl = `whatsapp://send?phone=${phone}&text=${encoded}`;
  const webUrl = `https://wa.me/${phone}?text=${encoded}`;

  try {
    const canApp = await Linking.canOpenURL(appUrl);
    if (canApp) {
      await Linking.openURL(appUrl);
      return { ok: true };
    }
    await Linking.openURL(webUrl);
    return { ok: true };
  } catch {
    Alert.alert(
      'WhatsApp',
      Platform.OS === 'ios'
        ? 'WhatsApp açılamadı. Uygulama yüklü mü kontrol edin.'
        : 'WhatsApp açılamadı.',
    );
    return { ok: false, error: 'open_failed' };
  }
}
