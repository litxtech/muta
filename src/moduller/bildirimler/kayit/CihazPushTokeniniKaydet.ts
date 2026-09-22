import { Platform, InteractionManager } from 'react-native';
import { supabase } from '../../../lib/supabase';
import {
  CihazKimliginiGetir,
  CihazPlatformunuGetir,
  UygulamaVersiyonunuGetir,
} from '../../kimlik-dogrulama/oturum/CihazKimliginiGetir';
import {
  AndroidFcmTokeniniAl,
  ExpoPushTokeniniAl,
} from './ExpoPushTokeniniAl';
import { BildirimIzniIste } from './BildirimIzniIste';

type PushProvider = 'apns' | 'fcm' | 'expo' | 'none';

async function tokenKaydet(
  deviceId: string,
  platform: string,
  provider: PushProvider,
  pushToken: string | null,
): Promise<{ ok: boolean; hata?: string }> {
  const { error } = await supabase.rpc('cihaz_push_token_kaydet', {
    p_device_id: deviceId,
    p_platform: platform === 'unknown' ? 'web' : platform,
    p_push_provider: provider,
    p_push_token: pushToken,
    p_app_version: UygulamaVersiyonunuGetir(),
    p_locale: null,
    p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}

/**
 * Android → Firebase FCM device token (asıl).
 * iOS → Expo Push Token (APNs / EAS).
 * Expo token Android'de yedek olarak da kaydedilir.
 * İzin her zaman token'dan önce istenir (BildirimIzniIste).
 */
export async function CihazPushTokeniniKaydet(input?: {
  pushToken?: string | null;
}): Promise<{ ok: boolean; hata?: string; token?: string | null }> {
  try {
    // UI settle olsun — splash/auth sırasında dialog bastırılmasın
    await new Promise<void>((resolve) => {
      InteractionManager.runAfterInteractions(() => resolve());
    });

    // Token almadan önce OS iznini net iste (Android FCM kapalı olsa bile dialog çıksın)
    await BildirimIzniIste();

    const deviceId = await CihazKimliginiGetir();
    const platform = CihazPlatformunuGetir();
    const plat = platform === 'unknown' ? 'web' : platform;

    if (Platform.OS === 'android') {
      const fcm =
        input?.pushToken && !input.pushToken.startsWith('ExponentPushToken')
          ? input.pushToken
          : await AndroidFcmTokeniniAl();

      if (fcm) {
        const r = await tokenKaydet(deviceId, plat, 'fcm', fcm);
        if (!r.ok) return { ...r, token: fcm };
      }

      const expo = await ExpoPushTokeniniAl();
      if (expo) {
        await tokenKaydet(deviceId, plat, 'expo', expo);
      }

      if (!fcm && !expo) {
        return {
          ok: false,
          hata: 'Bildirim izni veya FCM token yok',
          token: null,
        };
      }
      return { ok: true, token: fcm ?? expo };
    }

    // iOS / diğer
    let pushToken = input?.pushToken ?? null;
    if (pushToken === undefined || pushToken === null) {
      pushToken = await ExpoPushTokeniniAl();
    }
    const provider: PushProvider = pushToken ? 'expo' : BildirimPlatformuSec();
    const r = await tokenKaydet(deviceId, plat, provider, pushToken);
    if (!r.ok) return { ...r, token: pushToken };
    return { ok: true, token: pushToken };
  } catch (e) {
    return {
      ok: false,
      hata: e instanceof Error ? e.message : 'push kayit hatasi',
    };
  }
}

export function BildirimPlatformuSec(): PushProvider {
  if (Platform.OS === 'ios') return 'apns';
  if (Platform.OS === 'android') return 'fcm';
  return 'none';
}
