import { supabase } from '../../../lib/supabase';
import type { KullaniciDavetKodu } from '../tipler';

export async function BenimDavetKodumuAl(): Promise<KullaniciDavetKodu> {
  const { data, error } = await supabase.rpc('benim_davet_kodumu_al_veya_olustur');
  if (error) throw error;
  return data as KullaniciDavetKodu;
}

export async function PaylasimTiklamaKaydet(input: {
  shareCode?: string | null;
  linkCode?: string | null;
  platformHint?: string | null;
}): Promise<void> {
  await supabase.rpc('paylasim_tiklama_kaydet', {
    p_share_code: input.shareCode ?? null,
    p_link_code: input.linkCode ?? null,
    p_platform_hint: input.platformHint ?? null,
    p_user_agent: null,
  });
}
