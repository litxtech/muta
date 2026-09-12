import { supabase } from '../../../lib/supabase';

export async function OdaKapasiteKatmanlariniGetir() {
  const { data, error } = await supabase
    .from('room_capacity_tiers')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return data ?? [];
}

export async function OdaDuzenKatalogunuGetir() {
  const { data, error } = await supabase
    .from('room_layouts')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return data ?? [];
}
