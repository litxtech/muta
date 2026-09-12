import { supabase } from '../../../lib/supabase';

export type Ajans = {
  id: string;
  agency_public_id: string;
  name: string;
  country: string | null;
  description: string | null;
  level_code: string | null;
  host_count: number;
  total_gifts: number;
  monthly_score: number;
  trust_tier: string;
  is_coin_distributor: boolean;
  status: string;
  invite_code: string | null;
  owner_id: string;
};

export async function PopulerAjanslariGetir(limit = 20): Promise<Ajans[]> {
  const { data, error } = await supabase
    .from('agencies')
    .select('*')
    .eq('status', 'active')
    .order('monthly_score', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as Ajans[]) ?? [];
}

export async function SahipOlunanAjanslariGetir(): Promise<Ajans[]> {
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase
    .from('agencies')
    .select('*')
    .eq('owner_id', uid)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as Ajans[]) ?? [];
}

export async function AjansBasvurularimiGetir() {
  const { data, error } = await supabase
    .from('agency_applications')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
