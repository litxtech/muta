import { supabase } from '../../../../lib/supabase';
import type { AdminKullaniciDosyasi, AdminKullaniciOzet } from '../tipler';

export async function AdminKullaniciAra(
  q?: string,
  limit = 80,
): Promise<AdminKullaniciOzet[]> {
  const { data, error } = await supabase.rpc('admin_kullanici_ara', {
    p_q: q?.trim() || null,
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as AdminKullaniciOzet[];
}

export async function AdminKullaniciDosyasiGetir(
  userId: string,
): Promise<AdminKullaniciDosyasi> {
  const { data, error } = await supabase.rpc('admin_kullanici_dosyasi', {
    p_user_id: userId,
  });
  if (error) throw error;
  return data as AdminKullaniciDosyasi;
}
