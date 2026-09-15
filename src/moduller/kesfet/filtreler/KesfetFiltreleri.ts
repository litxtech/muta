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
  { id: 'global', label: 'Tümü' },
  { id: 'country', label: 'Ülke' },
  { id: 'language', label: 'Dil' },
  { id: 'online', label: 'Çevrimiçi' },
  { id: 'live', label: 'Canlı' },
  { id: 'voice_room', label: 'Ses Odası' },
  { id: 'new_creator', label: 'Yeni Yayıncı' },
  { id: 'trending', label: 'Trend' },
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
