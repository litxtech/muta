import { supabase } from '../../../lib/supabase';

export type KesfetKategorisi = {
  id: string;
  code: string;
  name: string;
  sort_order: number;
};

export type KesfetFiltresi =
  | 'global'
  | 'online'
  | 'new_creator'
  | 'trending';

export const KESFET_FILTRELERI: { id: KesfetFiltresi; label: string }[] = [
  { id: 'global', label: 'Tümü' },
  { id: 'trending', label: 'Trend' },
  { id: 'online', label: 'Aktif' },
  { id: 'new_creator', label: 'Yeni' },
];

export async function KesfetKategorileriniGetir(): Promise<KesfetKategorisi[]> {
  const { data, error } = await supabase
    .from('explore_categories')
    .select('id, code, name, sort_order')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return (data as KesfetKategorisi[]) ?? [];
}
