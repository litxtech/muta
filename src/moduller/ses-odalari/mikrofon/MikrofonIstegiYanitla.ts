import { supabase } from '../../../lib/supabase';
import i18n from '../../../i18n';

function hataMetni(raw?: string): string {
  const m = (raw ?? '').toLowerCase();
  if (m.includes('not authorized')) return i18n.t('sesOda.yetkiYok');
  if (m.includes('no free mic seat')) return i18n.t('sesOda.bosKoltukYok');
  if (m.includes('already resolved')) return i18n.t('sesOda.zatenYanitlandi');
  if (m.includes('not found')) return i18n.t('sesOda.istekBulunamadi');
  if (m.includes('not authenticated')) return i18n.t('ortak.oturumYok');
  if (m.includes('duplicate') || m.includes('unique')) {
    return i18n.t('sesOda.kayitCakismasi');
  }
  return raw?.trim() || i18n.t('sesOda.istekYanitlanamadi');
}

export async function MikrofonIstegiYanitla(input: {
  requestId: string;
  kabul: boolean;
}): Promise<{ ok: boolean; hata?: string }> {
  const { error } = await supabase.rpc('mikrofon_istegi_yanitla', {
    p_request_id: input.requestId,
    p_kabul: input.kabul,
  });
  if (error) return { ok: false, hata: hataMetni(error.message) };
  return { ok: true };
}
