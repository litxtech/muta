import { supabase } from '../../../lib/supabase';

export type SehirSecimi = {
  id: string;
  city_id: string;
  title: string;
  role_target: string;
  status: string;
  starts_at: string;
  ends_at: string;
  city?: { id: string; name: string; slug: string } | null;
};

export type SehirAdayi = {
  id: string;
  election_id: string;
  user_id: string;
  manifesto: string | null;
  vote_count: number;
  status: string;
};

export async function AktifSecimleriGetir(): Promise<SehirSecimi[]> {
  const { data, error } = await supabase
    .from('city_elections')
    .select('*, city:geo_cities(id, name, slug)')
    .in('status', ['nominating', 'voting'])
    .order('starts_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as SehirSecimi[];
}

export async function SecimAdaylariniGetir(electionId: string): Promise<SehirAdayi[]> {
  const { data, error } = await supabase
    .from('city_candidates')
    .select('*')
    .eq('election_id', electionId)
    .eq('status', 'approved')
    .order('vote_count', { ascending: false });
  if (error) throw error;
  return (data ?? []) as SehirAdayi[];
}
