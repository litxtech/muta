import { supabase } from '../../../lib/supabase';
import { KayitAlanAyarlariNormalize } from './KayitAlanAyarlariNormalize';
import {
  VARSAYILAN_KAYIT_ALAN_AYARLARI,
  type KayitAlanAyarlari,
} from './tipler';

let bellek: KayitAlanAyarlari | null = null;

export function KayitAlanAyarlariOnbellektenAl(): KayitAlanAyarlari | null {
  return bellek;
}

export function KayitAlanAyarlariOnbellegeYaz(ayar: KayitAlanAyarlari): void {
  bellek = ayar;
}

export async function KayitAlanAyarlariPublicGet(): Promise<KayitAlanAyarlari> {
  try {
    const { data, error } = await supabase.rpc('kayit_alan_ayarlari_public_get');
    if (error) throw error;
    const sonuc = KayitAlanAyarlariNormalize(data);
    KayitAlanAyarlariOnbellegeYaz(sonuc);
    return sonuc;
  } catch (e) {
    console.warn('[KayitAlanAyarlariPublicGet]', e);
    if (bellek) return bellek;
    return {
      ...VARSAYILAN_KAYIT_ALAN_AYARLARI,
      alanlar: { ...VARSAYILAN_KAYIT_ALAN_AYARLARI.alanlar },
      ozel_alanlar: [],
    };
  }
}
