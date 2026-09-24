import { supabase } from '../../../lib/supabase';
import type { CeviriAnahtari } from '../../../i18n/useCeviri';

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

export const KESFET_FILTRELERI: { id: KesfetFiltresi; label: CeviriAnahtari }[] = [
  { id: 'global', label: 'kesfet.filtreTumu' },
  { id: 'trending', label: 'kesfet.filtreTrend' },
  { id: 'online', label: 'kesfet.filtreAktif' },
  { id: 'new_creator', label: 'kesfet.filtreYeni' },
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
