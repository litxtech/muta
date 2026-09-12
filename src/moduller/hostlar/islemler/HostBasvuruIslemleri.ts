import { supabase } from '../../../lib/supabase';

export async function HostBasvurusuOlustur(input: {
  path: 'independent' | 'join_agency';
  inviteCode?: string;
}): Promise<{ ok: boolean; hata?: string }> {
  const { error } = await supabase.rpc('host_basvurusu_olustur', {
    p_path: input.path,
    p_invite_code: input.inviteCode ?? null,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}

/** Gelistirme: bagimsiz host hizli aktif */
export async function HostBagimsizAktifEt(): Promise<{ ok: boolean; hata?: string }> {
  const { error } = await supabase.rpc('host_bagimsiz_aktif_et');
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}
