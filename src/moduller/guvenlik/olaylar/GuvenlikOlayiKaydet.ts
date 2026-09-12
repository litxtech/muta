import { supabase } from '../../../lib/supabase';
import { CihazKimliginiGetir } from '../../kimlik-dogrulama/oturum/CihazKimliginiGetir';

/**
 * Mobil hafif risk sinyali — agir analiz backend'de.
 * Ana kullanici islemini bekletmez.
 */
export function GuvenlikOlayiKaydet(
  eventType: string,
  metadata?: Record<string, unknown>,
): void {
  void (async () => {
    try {
      const deviceId = await CihazKimliginiGetir();
      await supabase.rpc('guvenlik_olayi_kaydet', {
        p_event_type: eventType,
        p_device_id: deviceId,
        p_metadata: metadata ?? {},
      });
    } catch {
      // Tier 3 — sessizce yut
    }
  })();
}
