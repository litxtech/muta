import { supabase } from '../../../lib/supabase';
import { OzellikBayragiAktifMiSunucu } from '../../ozellik-bayraklari/okuma/OzellikBayragiAktifMiSunucu';

export async function SehirDestekGeriCek(input: {
  cityId: string;
}): Promise<{ ok: boolean; hata?: string }> {
  if (!(await OzellikBayragiAktifMiSunucu('city_league_enabled'))) {
    return { ok: false, hata: 'city_league_enabled bayrağı kapalı.' };
  }
  const { error } = await supabase.rpc('sehir_destek_geri_cek', {
    p_city_id: input.cityId,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}
