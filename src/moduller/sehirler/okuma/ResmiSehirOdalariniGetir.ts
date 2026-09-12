import { supabase } from '../../../lib/supabase';

export type ResmiSehirOdasi = {
  id: string;
  city_id: string;
  room_id: string | null;
  title: string;
  is_official: boolean;
  is_live: boolean;
  listener_count: number;
  sort_order: number;
};

export async function ResmiSehirOdalariniGetir(limit = 30): Promise<ResmiSehirOdasi[]> {
  const { data, error } = await supabase
    .from('official_city_rooms')
    .select('*')
    .order('sort_order', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ResmiSehirOdasi[];
}

export async function SehirRolleriniGetir(cityId: string) {
  const { data, error } = await supabase
    .from('city_roles')
    .select('*, profile:profiles!city_roles_user_id_fkey(id, display_name, username, public_user_id)')
    .eq('city_id', cityId)
    .eq('is_active', true);
  if (error) throw error;
  return data ?? [];
}
