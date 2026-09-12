import { supabase } from '../../../lib/supabase';

export async function CihazOturumlariniListele() {
  const { data, error } = await supabase
    .from('device_sessions')
    .select('*')
    .is('revoked_at', null)
    .order('last_seen_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function TekCihazOturumunuKapat(sessionId: string) {
  const { error } = await supabase
    .from('device_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', sessionId);
  if (error) throw error;
}

export async function TumCihazOturumlariniKapat(haricDeviceId?: string) {
  let q = supabase
    .from('device_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .is('revoked_at', null);
  if (haricDeviceId) {
    q = q.neq('device_id', haricDeviceId);
  }
  const { error } = await q;
  if (error) throw error;
}
