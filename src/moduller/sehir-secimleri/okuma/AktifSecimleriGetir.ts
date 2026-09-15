import { supabase } from '../../../lib/supabase';

export type SehirSecimi = {
  id: string;
  city_id: string;
  title: string;
  role_target: string;
  status: string;
  starts_at: string;
  ends_at: string;
  total_votes?: number;
  city?: { id: string; name: string; slug: string } | null;
};

export type SehirAdayi = {
  id: string;
  election_id: string;
  user_id: string;
  manifesto: string | null;
  vote_count: number;
  status: string;
  display_name?: string;
  username?: string | null;
  avatar_url?: string | null;
  percent?: number;
};

export async function AktifSecimleriGetir(): Promise<SehirSecimi[]> {
  const { data, error } = await supabase
    .from('city_elections')
    .select('*, city:geo_cities(id, name, slug)')
    .in('status', ['nominating', 'voting', 'tallied'])
    .order('starts_at', { ascending: false })
    .limit(40);
  if (error) throw error;
  return (data ?? []) as SehirSecimi[];
}

export async function SecimAdaylariniGetir(electionId: string): Promise<SehirAdayi[]> {
  const { data, error } = await supabase
    .from('city_candidates')
    .select(
      'id, election_id, user_id, manifesto, vote_count, status, created_at, profiles:user_id(display_name, username, avatar_url)',
    )
    .eq('election_id', electionId)
    .eq('status', 'approved')
    .order('vote_count', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    election_id: r.election_id,
    user_id: r.user_id,
    manifesto: r.manifesto,
    vote_count: r.vote_count,
    status: r.status,
    display_name: r.profiles?.display_name ?? r.profiles?.username ?? 'Aday',
    username: r.profiles?.username ?? null,
    avatar_url: r.profiles?.avatar_url ?? null,
  }));
}
