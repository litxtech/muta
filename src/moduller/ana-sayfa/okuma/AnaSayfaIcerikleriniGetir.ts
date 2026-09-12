import { supabase } from '../../../lib/supabase';
import type { Room } from '../../../types/models';

export async function CanliOdalariGetir(limit = 20): Promise<Room[]> {
  const { data, error } = await supabase
    .from('rooms')
    .select('*, host:profiles!rooms_host_id_fkey(*)')
    .eq('is_live', true)
    .order('listener_count', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as Room[]) ?? [];
}

export async function TrendOdalariGetir(limit = 10): Promise<Room[]> {
  const { data, error } = await supabase
    .from('rooms')
    .select('*, host:profiles!rooms_host_id_fkey(*)')
    .eq('is_live', true)
    .order('total_coins_earned', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as Room[]) ?? [];
}
