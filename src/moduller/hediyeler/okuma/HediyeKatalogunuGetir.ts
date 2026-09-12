import { supabase } from '../../../lib/supabase';
import type { Gift } from '../../../types/models';

export async function HediyeKatalogunuGetir(): Promise<Gift[]> {
  const { data, error } = await supabase
    .from('gifts')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return (data as Gift[]) ?? [];
}
