import { supabase } from '../../../lib/supabase';
import { LiveKitBaglantiYoneticisi } from '../../livekit/baglanti/LiveKitBaglantiYoneticisi';

/**
 * Çıkış / ban / silme öncesi: host’un canlı odaları + yayınları kapat.
 * Auth hâlâ açıkken çağrılmalı; hata çıkışı engellemez.
 */
export async function CikisCanliIcerikleriKapat(): Promise<void> {
  try {
    await supabase.rpc('cikis_canli_icerikleri_kapat');
  } catch {
    /* RPC yoksa veya ağ hatası — yine de çık */
  }

  try {
    await LiveKitBaglantiYoneticisi.baglantiyiKes();
  } catch {
    /* medya bağlantısı yoksa sorun değil */
  }
}
