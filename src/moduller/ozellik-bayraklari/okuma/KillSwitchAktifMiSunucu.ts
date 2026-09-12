import { supabase } from '../../../lib/supabase';
import type { KillSwitchAnahtari } from '../../ozellik-bayraklari/OzellikBayragiAnahtarlari';

/**
 * Kill switch — once remote RPC, sonra yerel varsayilan.
 * Finans islemlerinden once cagir.
 */
export async function KillSwitchAktifMiSunucu(
  anahtar: KillSwitchAnahtari,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('kill_switch_aktif_mi', {
    p_key: anahtar,
  });
  if (error) {
    // Fail-closed for Tier 1 finance when uncertain? Plan: graceful — local fallback
    const { KillSwitchAktifMi } = await import(
      '../../ozellik-bayraklari/OzellikBayragiAktifMi'
    );
    return KillSwitchAktifMi(anahtar);
  }
  return Boolean(data);
}
