import { supabase } from '../../../lib/supabase';

export type OturumKorumaDurumu = {
  ok: boolean;
  kod: 'active' | 'banned' | 'deleted' | 'no_auth' | 'no_profile' | string;
  mesaj?: string;
  banned_at?: string;
  deleted_at?: string;
};

/**
 * Ban / silinmis hesap kontrolu.
 * Oturum SecureStore'da kalici; bu kontrol sadece engel durumunu yakalar.
 */
export async function OturumKorumaDurumunuGetir(): Promise<OturumKorumaDurumu> {
  const { data, error } = await supabase.rpc('oturum_koruma_durumu');
  if (error) {
    // Migration yoksa oturumu bozma
    console.warn('[OturumKoruma]', error.message);
    return { ok: true, kod: 'active', mesaj: 'kontrol atlandi' };
  }
  return data as OturumKorumaDurumu;
}
