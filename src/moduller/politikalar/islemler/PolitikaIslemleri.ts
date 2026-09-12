import { supabase } from '../../../lib/supabase';
import { OzellikBayragiAktifMiSunucu } from '../../ozellik-bayraklari/okuma/OzellikBayragiAktifMiSunucu';

export type PolitikaSurumu = {
  id: string;
  policy_code: string;
  version: number;
  body_md: string;
  published_at: string;
  policies?: { title: string; is_required: boolean } | null;
};

export async function GuncelPolitikalariGetir(): Promise<PolitikaSurumu[]> {
  const { data, error } = await supabase
    .from('policy_versions')
    .select('*, policies(title, is_required)')
    .order('version', { ascending: false });
  if (error) throw error;
  const rows = (data as PolitikaSurumu[]) ?? [];
  const seen = new Set<string>();
  return rows.filter((r) => {
    if (seen.has(r.policy_code)) return false;
    seen.add(r.policy_code);
    return true;
  });
}

export async function PolitikaKabulEt(policyVersionId: string) {
  if (!(await OzellikBayragiAktifMiSunucu('policies_enabled'))) {
    return { ok: false as const, hata: 'policies_enabled kapalı.' };
  }
  const { error } = await supabase.rpc('politika_kabul_et', {
    p_policy_version_id: policyVersionId,
  });
  if (error) return { ok: false as const, hata: error.message };
  return { ok: true as const };
}
