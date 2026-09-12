import { supabase } from '../../../lib/supabase';

export type PlatformSaglikOzeti = {
  ok: boolean;
  reconciliation_recent: unknown[];
  feature_flags: Record<string, boolean>;
  kill_switches: Record<string, boolean>;
  certification_checks: unknown[];
  generated_at: string;
};

export async function PlatformSaglikOzetiniGetir(): Promise<PlatformSaglikOzeti | null> {
  const { data, error } = await supabase.rpc('platform_saglik_ozeti');
  if (error) throw error;
  return (data as PlatformSaglikOzeti) ?? null;
}
