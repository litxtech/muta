import { supabase } from '../../../lib/supabase';

export type GuvenlikOlayi = {
  id: string;
  event_type: string;
  risk_score: number;
  severity: string;
  status: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

export async function GuvenlikOlaylarimiGetir(limit = 30): Promise<GuvenlikOlayi[]> {
  const { data, error } = await supabase
    .from('security_events')
    .select('id, event_type, risk_score, severity, status, created_at, metadata')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as GuvenlikOlayi[]) ?? [];
}
