import { supabase } from '../../../lib/supabase';

export async function MikrofonIstegiYanitla(input: {
  requestId: string;
  kabul: boolean;
}): Promise<{ ok: boolean; hata?: string }> {
  const { error } = await supabase.rpc('mikrofon_istegi_yanitla', {
    p_request_id: input.requestId,
    p_kabul: input.kabul,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}
