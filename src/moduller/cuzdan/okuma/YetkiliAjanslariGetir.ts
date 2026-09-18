import { supabase } from '../../../lib/supabase';

export type YetkiliAjans = {
  id: string;
  name: string;
  agency_public_id: string | null;
  logo_url: string | null;
  slogan: string | null;
  owner_id: string;
  monthly_score: number;
  coin_auto_message: string | null;
};

export async function YetkiliAjanslariGetir(
  limit = 40,
): Promise<YetkiliAjans[]> {
  const { data, error } = await supabase.rpc('yetkili_ajanslari_listele', {
    p_limit: limit,
  });
  if (error) {
    console.warn('[YetkiliAjanslariGetir]', error.message);
    return [];
  }
  return ((data as YetkiliAjans[]) ?? []).map((a) => ({
    ...a,
    monthly_score: Number(a.monthly_score) || 0,
  }));
}

export async function AjansCoinAutoMesajAyarla(
  agencyId: string,
  message: string | null,
): Promise<{ ok: true } | { ok: false; hata: string }> {
  const { error } = await supabase.rpc('ajans_coin_auto_mesaj_ayarla', {
    p_agency_id: agencyId,
    p_message: message,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}
