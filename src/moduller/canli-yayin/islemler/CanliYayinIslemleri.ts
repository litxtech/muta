import { supabase } from '../../../lib/supabase';

export async function CanliYayinBaslat(input: {
  title: string;
  mode?: string;
}): Promise<{ ok: true; session: unknown } | { ok: false; hata: string }> {
  const { data, error } = await supabase.rpc('canli_yayin_baslat', {
    p_title: input.title,
    p_mode: input.mode ?? 'solo',
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true, session: data };
}

export async function CanliYayinlariGetir(limit = 20) {
  const { data, error } = await supabase
    .from('live_sessions')
    .select('*, host:profiles!live_sessions_host_id_fkey(id, display_name, username, public_user_id, level)')
    .eq('is_live', true)
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
