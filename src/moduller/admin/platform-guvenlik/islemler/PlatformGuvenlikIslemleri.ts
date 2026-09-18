import { supabase } from '../../../../lib/supabase';
import type {
  PlatformGuvenlikDetay,
  PlatformGuvenlikUyari,
} from './tipler';

export async function AdminPlatformGuvenlikListesi(
  limit = 60,
  status?: string | null,
): Promise<PlatformGuvenlikUyari[]> {
  const { data, error } = await supabase.rpc('admin_platform_guvenlik_listele', {
    p_limit: limit,
    p_status: status ?? null,
  });
  if (error) throw new Error(error.message);
  if (!Array.isArray(data)) return [];
  return data as PlatformGuvenlikUyari[];
}

export async function AdminPlatformGuvenlikDetay(
  id: string,
): Promise<PlatformGuvenlikDetay> {
  const { data, error } = await supabase.rpc('admin_platform_guvenlik_detay', {
    p_id: id,
  });
  if (error) throw new Error(error.message);
  return (data ?? { ok: false, hata: 'empty' }) as PlatformGuvenlikDetay;
}

export async function AdminPlatformGuvenlikDurum(
  id: string,
  status: 'open' | 'reviewing' | 'resolved' | 'ignored',
  note?: string,
): Promise<{ ok: boolean; hata?: string }> {
  const { data, error } = await supabase.rpc('admin_platform_guvenlik_durum', {
    p_id: id,
    p_status: status,
    p_note: note ?? null,
  });
  if (error) return { ok: false, hata: error.message };
  const j = data as { ok?: boolean; hata?: string };
  return { ok: j?.ok !== false, hata: j?.hata };
}

export async function AdminCihazEngelle(
  deviceId: string,
  reason: string,
): Promise<{ ok: boolean; hata?: string }> {
  const { data, error } = await supabase.rpc('admin_cihaz_engelle', {
    p_device_id: deviceId,
    p_reason: reason,
  });
  if (error) return { ok: false, hata: error.message };
  const j = data as { ok?: boolean };
  return { ok: j?.ok !== false };
}
