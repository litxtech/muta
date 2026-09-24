import { supabase } from '../../../lib/supabase';
import { DilNormalizeEt, type UygulamaDili } from '../../../i18n/diller';

/** Girişli kullanıcının profiles.language alanını günceller (en iyi çaba). */
export async function ProfilDiliniKaydet(
  dil: UygulamaDili | string,
): Promise<void> {
  try {
    const kod = DilNormalizeEt(dil);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) return;
    await supabase.from('profiles').update({ language: kod }).eq('id', user.id);
  } catch {
    /* çevrimdışı / RLS — yerel ayar yeterli */
  }
}
