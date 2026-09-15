import { supabase } from '../../../lib/supabase';

export type GeoSehir = {
  id: string;
  country_code: string;
  name: string;
  slug: string;
  timezone: string | null;
  is_active: boolean;
  supporter_count: number;
  power_score: number;
  plate_code?: string | null;
};

export async function SehirleriGetir(limit = 100): Promise<GeoSehir[]> {
  // Tercihen 81 TR plaka sirasi
  const tr = await supabase.rpc('tr_sehirleri_listesi');
  if (!tr.error && Array.isArray(tr.data) && tr.data.length) {
    return (tr.data as any[]).slice(0, limit).map((r) => ({
      id: r.id,
      country_code: r.country_code ?? 'TR',
      name: r.name,
      slug: r.slug,
      timezone: 'Europe/Istanbul',
      is_active: true,
      supporter_count: Number(r.supporter_count) || 0,
      power_score: Number(r.power_score) || 0,
      plate_code: r.plate_code ?? null,
    }));
  }

  const { data, error } = await supabase
    .from('geo_cities')
    .select('*')
    .eq('is_active', true)
    .eq('country_code', 'TR')
    .order('name')
    .limit(limit);
  if (error) throw error;
  return (data as GeoSehir[]) ?? [];
}

export async function SehirUlkeleriniGetir() {
  const { data, error } = await supabase
    .from('geo_countries')
    .select('*')
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return data ?? [];
}
