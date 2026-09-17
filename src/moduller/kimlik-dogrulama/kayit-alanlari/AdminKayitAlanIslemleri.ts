import { supabase } from '../../../lib/supabase';
import { KayitAlanAyarlariNormalize } from './KayitAlanAyarlariNormalize';
import { KayitAlanAyarlariOnbellegeYaz } from './KayitAlanAyarlariPublicGet';
import type {
  KayitAlanAyarlari,
  KayitAlanModu,
  YerlesikKayitAlani,
} from './tipler';

function parse(data: unknown): KayitAlanAyarlari {
  const sonuc = KayitAlanAyarlariNormalize(data);
  KayitAlanAyarlariOnbellegeYaz(sonuc);
  return sonuc;
}

export const AdminKayitAlanIslemleri = {
  async getir(): Promise<KayitAlanAyarlari> {
    const { data, error } = await supabase.rpc('admin_kayit_alan_ayarlari_get');
    if (error) throw new Error(error.message);
    return parse(data);
  },

  async yerlesikGuncelle(
    alanlar: Record<YerlesikKayitAlani, KayitAlanModu>,
  ): Promise<KayitAlanAyarlari> {
    const { data, error } = await supabase.rpc(
      'admin_kayit_alan_ayarlari_guncelle',
      { p_alanlar: alanlar },
    );
    if (error) throw new Error(error.message);
    return parse(data);
  },

  async ozelEkle(input: {
    etiket: string;
    anahtar?: string;
    alan_turu?: 'text' | 'select' | 'number';
    mod?: 'required' | 'optional';
    secenekler?: string[];
    sira?: number;
  }): Promise<KayitAlanAyarlari> {
    const { data, error } = await supabase.rpc('admin_kayit_ozel_alan_ekle', {
      p_payload: {
        etiket: input.etiket,
        anahtar: input.anahtar ?? '',
        alan_turu: input.alan_turu ?? 'text',
        mod: input.mod ?? 'optional',
        secenekler: input.secenekler ?? [],
        sira: input.sira ?? 0,
      },
    });
    if (error) throw new Error(error.message);
    return parse(data);
  },

  async ozelGuncelle(
    id: string,
    payload: {
      etiket?: string;
      alan_turu?: 'text' | 'select' | 'number';
      mod?: 'required' | 'optional';
      secenekler?: string[];
      sira?: number;
      aktif?: boolean;
    },
  ): Promise<KayitAlanAyarlari> {
    const { data, error } = await supabase.rpc(
      'admin_kayit_ozel_alan_guncelle',
      { p_id: id, p_payload: payload },
    );
    if (error) throw new Error(error.message);
    return parse(data);
  },

  async ozelSil(id: string): Promise<KayitAlanAyarlari> {
    const { data, error } = await supabase.rpc('admin_kayit_ozel_alan_sil', {
      p_id: id,
    });
    if (error) throw new Error(error.message);
    return parse(data);
  },
};
