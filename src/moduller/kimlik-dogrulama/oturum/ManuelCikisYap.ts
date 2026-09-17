import { supabase } from '../../../lib/supabase';
import { GuvenlikOlayiKaydet } from '../../guvenlik/olaylar/GuvenlikOlayiKaydet';
import { CihazKimliginiGetir } from './CihazKimliginiGetir';
import { TumCihazOturumlariniKapat } from './CihazOturumlariniYonet';
import { CikisCanliIcerikleriKapat } from './CikisCanliIcerikleriKapat';
import { OturumGecmisindenKaldir } from '../oturum-gecmisi/OturumGecmisiDepolama';

export type CikisNedeni = 'manual' | 'ban' | 'account_deleted' | 'device_revoke';

/**
 * Tek oturum sonlandirma yolu (manuel cikis / ban / hesap silme).
 * Arka plan, token yenileme veya app kill oturumu BITIRMEZ.
 * Cikis oncesi host'un canli oda / yayinlari kapatilir (listeden duser).
 */
export async function ManuelCikisYap(neden: CikisNedeni = 'manual'): Promise<void> {
  GuvenlikOlayiKaydet('logout', { reason: neden });

  if (neden === 'ban' || neden === 'account_deleted') {
    try {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id;
      if (uid) await OturumGecmisindenKaldir(uid);
    } catch {
      /* gecmis temizligi zorunlu degil */
    }
  }

  // Auth bitmeden once: ses odasi + canli yayin + LiveKit
  await CikisCanliIcerikleriKapat();

  try {
    if (neden === 'manual') {
      const deviceId = await CihazKimliginiGetir();
      await supabase
        .from('device_sessions')
        .update({ revoked_at: new Date().toISOString() })
        .eq('device_id', deviceId)
        .is('revoked_at', null);
    } else {
      await TumCihazOturumlariniKapat();
    }
  } catch {
    /* cihaz kaydi yoksa yine de cikis */
  }

  await supabase.auth.signOut({
    scope: neden === 'manual' ? 'local' : 'global',
  });
}
