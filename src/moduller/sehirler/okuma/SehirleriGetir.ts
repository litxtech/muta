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
};

export async function SehirleriGetir(limit = 40): Promise<GeoSehir[]> {
  const { data, error } = await supabase
    .from('geo_cities')
    .select('*')
    .eq('is_active', true)
    .order('power_score', { ascending: false })
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
