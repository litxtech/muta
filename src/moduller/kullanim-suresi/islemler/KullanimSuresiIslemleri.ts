import { supabase } from '../../../lib/supabase';

export async function KullanimSuresiGetir(
  userId?: string | null,
): Promise<number> {
  const { data, error } = await supabase.rpc('kullanim_suresi_getir', {
    p_user_id: userId ?? null,
  });
  if (error) return 0;
  return Math.max(0, Math.floor(Number(data) || 0));
}

/** Bekleyen saniyeyi sunucuya ekler; yeni toplamı döner */
export async function KullanimSuresiEkle(
  seconds: number,
): Promise<{ ok: true; total: number } | { ok: false; hata: string }> {
  const n = Math.max(0, Math.floor(seconds));
  if (n <= 0) {
    const total = await KullanimSuresiGetir();
    return { ok: true, total };
  }
  const { data, error } = await supabase.rpc('kullanim_suresi_ekle', {
    p_seconds: n,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true, total: Math.max(0, Math.floor(Number(data) || 0)) };
}
