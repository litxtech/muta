import { Platform } from 'react-native';
import { supabase } from '../../../lib/supabase';
import {
  CihazKimliginiGetir,
  CihazPlatformunuGetir,
  UygulamaVersiyonunuGetir,
} from '../../kimlik-dogrulama/oturum/CihazKimliginiGetir';

/**
 * Notification Gateway istemcisi — APNs/FCM secret burada yok.
 * Token kaydi; gonderim backend outbox ile.
 */
export async function CihazPushTokeniniKaydet(input?: {
  pushToken?: string | null;
}): Promise<{ ok: boolean; hata?: string }> {
  try {
    const deviceId = await CihazKimliginiGetir();
    const platform = CihazPlatformunuGetir();
    const provider =
      platform === 'ios' ? 'apns' : platform === 'android' ? 'fcm' : 'none';

    const { error } = await supabase.rpc('cihaz_push_token_kaydet', {
      p_device_id: deviceId,
      p_platform: platform === 'unknown' ? 'web' : platform,
      p_push_provider: provider,
      p_push_token: input?.pushToken ?? null,
      p_app_version: UygulamaVersiyonunuGetir(),
      p_locale: null,
      p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
    });
    if (error) return { ok: false, hata: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, hata: e instanceof Error ? e.message : 'push kayit hatasi' };
  }
}

export function BildirimPlatformuSec(): 'apns' | 'fcm' | 'none' {
  if (Platform.OS === 'ios') return 'apns';
  if (Platform.OS === 'android') return 'fcm';
  return 'none';
}
