import { supabase } from '../../../lib/supabase';

export type SertifikasyonKontrolu = {
  code: string;
  title: string;
  category: string;
  status: 'pending' | 'pass' | 'fail' | 'skip' | string;
  details: Record<string, unknown>;
  updated_at: string;
};

export async function SertifikasyonKontrolleriniGetir(): Promise<
  SertifikasyonKontrolu[]
> {
  const { data, error } = await supabase
    .from('certification_checks')
    .select('code, title, category, status, details, updated_at')
    .order('category', { ascending: true });
  if (error) throw error;
  return (data ?? []) as SertifikasyonKontrolu[];
}

export async function SertifikasyonKontrolGuncelle(input: {
  code: string;
  status: 'pending' | 'pass' | 'fail' | 'skip';
  details?: Record<string, unknown>;
}): Promise<{ ok: boolean; hata?: string }> {
  const { error } = await supabase.rpc('sertifikasyon_kontrol_guncelle', {
    p_code: input.code,
    p_status: input.status,
    p_details: input.details ?? {},
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}
