import { supabase } from '../../../lib/supabase';

export type SehirSavasi = {
  id: string;
  season_id: string | null;
  city_a_id: string;
  city_b_id: string;
  score_a: number;
  score_b: number;
  status: string;
  winner_city_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  city_a?: { id: string; name: string; slug: string } | null;
  city_b?: { id: string; name: string; slug: string } | null;
};

export async function AktifSehirSavaslariniGetir(): Promise<SehirSavasi[]> {
  const { data, error } = await supabase
    .from('city_battles')
    .select(
      '*, city_a:geo_cities!city_battles_city_a_id_fkey(id, name, slug), city_b:geo_cities!city_battles_city_b_id_fkey(id, name, slug)',
    )
    .in('status', ['scheduled', 'live'])
    .order('starts_at', { ascending: true })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as SehirSavasi[];
}
