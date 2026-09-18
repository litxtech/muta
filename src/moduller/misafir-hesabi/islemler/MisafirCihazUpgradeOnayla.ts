import { supabase } from '../../../lib/supabase';
import { CihazKimliginiGetir } from '../../kimlik-dogrulama/oturum/CihazKimliginiGetir';
import { MisafirCihazOturumuTemizle } from './MisafirCihazOturumDepolama';

/** E-posta doğrulandıktan sonra cihaz bağını upgraded yapar. */
export async function MisafirCihazUpgradeOnayla(): Promise<void> {
  try {
    const deviceId = await CihazKimliginiGetir();
    await supabase.rpc('misafir_cihaz_upgrade_onay', {
      p_device_id: deviceId,
    });
    await MisafirCihazOturumuTemizle();
  } catch {
    /* non-blocking */
  }
}
