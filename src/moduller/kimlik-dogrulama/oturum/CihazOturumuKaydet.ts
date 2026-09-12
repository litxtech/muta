import { supabase } from '../../../lib/supabase';
import {
  CihazKimliginiGetir,
  CihazPlatformunuGetir,
  UygulamaVersiyonunuGetir,
} from './CihazKimliginiGetir';

/** Aktif cihaz oturumunu backend'e kaydeder / yeniler */
export async function CihazOturumuKaydet(): Promise<{ error?: string }> {
  try {
    const deviceId = await CihazKimliginiGetir();
    const { error } = await supabase.rpc('cihaz_oturumu_kaydet', {
      p_device_id: deviceId,
      p_platform: CihazPlatformunuGetir(),
      p_device_model: null,
      p_app_version: UygulamaVersiyonunuGetir(),
      p_locale: null,
      p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
    });
    if (error) return { error: error.message };
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'cihaz oturumu hatasi' };
  }
}
