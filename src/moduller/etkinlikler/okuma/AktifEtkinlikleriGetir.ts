import { supabase } from '../../../lib/supabase';

export type PlatformEtkinligi = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  deep_link: string | null;
};

export async function AktifEtkinlikleriGetir(limit = 20): Promise<PlatformEtkinligi[]> {
  const { data, error } = await supabase
    .from('platform_events')
    .select('*')
    .in('status', ['scheduled', 'live'])
    .order('sort_order', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data as PlatformEtkinligi[]) ?? [];
}
