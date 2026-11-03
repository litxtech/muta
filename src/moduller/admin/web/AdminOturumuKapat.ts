import { supabase } from '../../../lib/supabase';
import { GuvenlikOlayiKaydet } from '../../guvenlik/olaylar/GuvenlikOlayiKaydet';
import { guvenliMeta } from './AdminKayitGuvenligi';

export type AdminCikisNedeni =
  | 'manual'
  | 'idle'
  | 'suresi_doldu'
  | 'yetkisiz'
  | 'sekme_kapandi';

/**
 * Yönetim panelinden zorunlu/elle çıkış.
 *
 * Tek oturum sonlandırma yolu budur: panelde otomatik zaman aşımı olmadığı
 * için çıkış yalnızca "Çıkış" düğmesinden veya yetki kaybından tetiklenir.
 *
 * Mobil çıkış akışından (ManuelCikisYap) bilinçli olarak ayrıdır:
 *  - oturum geçmişine KAYDETMEZ (tek tıkla geri giriş yolu bırakmaz),
 *  - yalnızca bu cihazdaki oturumu değil, yenileme belirtecini de iptal eder,
 *  - kimlik bilgisi (e-posta/şifre) hiçbir kayda yazılmaz.
 */
export async function AdminOturumuKapat(
  neden: AdminCikisNedeni = 'manual',
): Promise<void> {
  // Bilinen olay tipi kullanılır ('logout'); ayrım meta veride tutulur.
  GuvenlikOlayiKaydet('logout', guvenliMeta({ reason: neden, surface: 'admin_web' }));

  try {
    // global: elde tutulan refresh token'ları da geçersiz kıl.
    await supabase.auth.signOut({ scope: 'global' });
  } catch {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      /* ağ yok — yerel oturum zaten temizlenemediyse kapı yönlendirir */
    }
  }
}
