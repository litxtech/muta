import { supabase } from '../../../lib/supabase';

export async function DesteklenenSehirleriGetir() {
  const { data, error } = await supabase
    .from('user_supported_cities')
    .select('*, city:geo_cities(*)')
    .order('supported_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
