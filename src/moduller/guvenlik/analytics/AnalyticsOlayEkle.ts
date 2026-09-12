import { supabase } from '../../../lib/supabase';

/** Fault-isolated: hata yut; kullanici akisini bozma */
export async function AnalyticsOlayEkle(
  eventName: string,
  props?: Record<string, unknown>,
): Promise<void> {
  try {
    await supabase.rpc('analytics_olay_ekle', {
      p_event_name: eventName,
      p_props: props ?? {},
    });
  } catch {
    /* ignore */
  }
}
