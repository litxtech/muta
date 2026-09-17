import { supabase } from '../../../lib/supabase';

function hataMetni(raw?: string): string {
  const m = (raw ?? '').toLowerCase();
  if (m.includes('not authorized')) return 'Bu isteği yanıtlama yetkin yok.';
  if (m.includes('no free mic seat')) return 'Boş koltuk yok.';
  if (m.includes('already resolved')) return 'Bu istek zaten yanıtlandı.';
  if (m.includes('not found')) return 'İstek bulunamadı.';
  if (m.includes('not authenticated')) return 'Oturum gerekli.';
  if (m.includes('duplicate') || m.includes('unique')) {
    return 'Kayıt çakışması. Tekrar dene.';
  }
  return raw?.trim() || 'İstek yanıtlanamadı.';
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
