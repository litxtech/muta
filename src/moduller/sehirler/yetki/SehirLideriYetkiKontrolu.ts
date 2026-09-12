import { supabase } from '../../../lib/supabase';

/**
 * City leader / vice yetkisi — UI kapisi.
 * Gercek yetki RPC / backend dogrular.
 */
export async function SehirLideriYetkiKontrolu(input: {
  cityId: string;
  userId: string;
  roller?: Array<'leader' | 'vice_leader'>;
}): Promise<{ yetkili: boolean; rol?: string }> {
  const allowed = input.roller ?? ['leader', 'vice_leader'];
  const { data, error } = await supabase
    .from('city_roles')
    .select('role')
    .eq('city_id', input.cityId)
    .eq('user_id', input.userId)
    .eq('is_active', true)
    .in('role', allowed)
    .limit(1)
    .maybeSingle();
  if (error || !data) return { yetkili: false };
  return { yetkili: true, rol: data.role as string };
}
