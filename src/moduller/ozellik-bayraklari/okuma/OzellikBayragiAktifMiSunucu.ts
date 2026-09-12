import { supabase } from '../../../lib/supabase';
import type { OzellikBayragiAnahtari } from '../OzellikBayragiAnahtarlari';
import { OzellikBayragiAktifMi } from '../OzellikBayragiAktifMi';

export async function OzellikBayragiAktifMiSunucu(
  anahtar: OzellikBayragiAnahtari,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('ozellik_bayragi_aktif_mi', {
    p_key: anahtar,
  });
  if (error) return OzellikBayragiAktifMi(anahtar);
  return Boolean(data);
}
