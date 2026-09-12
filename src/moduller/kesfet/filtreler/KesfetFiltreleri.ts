import { supabase } from '../../../lib/supabase';

export type KesfetKategorisi = {
  id: string;
  code: string;
  name: string;
  sort_order: number;
};

export type KesfetFiltresi =
  | 'global'
  | 'country'
  | 'language'
  | 'online'
  | 'live'
  | 'voice_room'
  | 'new_creator'
  | 'trending';

export const KESFET_FILTRELERI: { id: KesfetFiltresi; label: string }[] = [
  { id: 'global', label: 'Global' },
  { id: 'country', label: 'Country' },
  { id: 'language', label: 'Language' },
  { id: 'online', label: 'Online' },
  { id: 'live', label: 'Live' },
  { id: 'voice_room', label: 'Voice Room' },
  { id: 'new_creator', label: 'New Creator' },
  { id: 'trending', label: 'Trending' },
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
