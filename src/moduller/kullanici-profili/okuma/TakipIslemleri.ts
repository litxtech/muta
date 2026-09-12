import { supabase } from '../../../lib/supabase';

export async function TakipEt(hedefKullaniciId: string): Promise<{ ok: boolean; hata?: string }> {
  const { error } = await supabase.rpc('takip_et', { p_target_id: hedefKullaniciId });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}

export async function TakibiBirak(hedefKullaniciId: string): Promise<{ ok: boolean; hata?: string }> {
  const { error } = await supabase.rpc('takibi_birak', { p_target_id: hedefKullaniciId });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}

export async function TakipEdiliyorMu(hedefKullaniciId: string): Promise<boolean> {
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid) return false;
  const { data } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('follower_id', uid)
    .eq('following_id', hedefKullaniciId)
    .maybeSingle();
  return !!data;
}
