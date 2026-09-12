import { supabase } from '../../../lib/supabase';

export type SehirLigSirasi = {
  season_id: string;
  city_id: string;
  points: number;
  gifts_score: number;
  battle_wins: number;
  rank: number | null;
  city?: { id: string; name: string; slug: string; country_code: string } | null;
};

export async function AktifLigSezonunuGetir() {
  const { data, error } = await supabase
    .from('city_league_seasons')
    .select('*')
    .eq('status', 'active')
    .order('starts_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function SehirLigiSiralamasiniGetir(seasonId?: string): Promise<SehirLigSirasi[]> {
  let sid = seasonId;
  if (!sid) {
    const season = await AktifLigSezonunuGetir();
    sid = season?.id;
  }
  if (!sid) return [];

  const { data, error } = await supabase
    .from('city_league_standings')
    .select('*, city:geo_cities(id, name, slug, country_code)')
    .eq('season_id', sid)
    .order('points', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as SehirLigSirasi[];
}
