import { supabase } from '../../../lib/supabase';

export type HostProfil = {
  user_id: string;
  agency_id: string | null;
  status: string;
  daily_live_seconds: number;
  monthly_live_seconds: number;
  total_live_seconds: number;
  gift_income_diamonds: number;
  unique_gifters: number;
  pk_wins: number;
  violations: number;
};

export async function HostProfilimiGetir(): Promise<HostProfil | null> {
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from('host_profiles')
    .select('*')
    .eq('user_id', uid)
    .maybeSingle();
  if (error) throw error;
  return data as HostProfil | null;
}

export async function HostBasvurularimiGetir() {
  const { data, error } = await supabase
    .from('host_applications')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function HostHedefleriniGetir(agencyId?: string) {
  let q = supabase.from('host_targets').select('*').eq('is_active', true);
  if (agencyId) q = q.eq('agency_id', agencyId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}
