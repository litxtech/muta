import { supabase } from '../../../lib/supabase';
import type { GeoSehir } from './SehirleriGetir';

export type DesteklenenSehir = {
  user_id: string;
  city_id: string;
  is_primary: boolean;
  supported_at: string;
  city?: GeoSehir | null;
};

export async function DesteklenenSehirleriGetir(): Promise<DesteklenenSehir[]> {
  const { data, error } = await supabase
    .from('user_supported_cities')
    .select('*, city:geo_cities(*)')
    .order('is_primary', { ascending: false })
    .order('supported_at', { ascending: false });
  if (error) throw error;
  return (data as DesteklenenSehir[]) ?? [];
}

/** Kullanıcının ana şehri (is_primary veya en son destek). */
export async function AnaSehirGetir(): Promise<DesteklenenSehir | null> {
  const list = await DesteklenenSehirleriGetir();
  if (!list.length) return null;
  return list.find((x) => x.is_primary) ?? list[0] ?? null;
}
