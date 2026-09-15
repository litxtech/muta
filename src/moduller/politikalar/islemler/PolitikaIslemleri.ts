import { supabase } from '../../../lib/supabase';
import { OzellikBayragiAktifMiSunucu } from '../../ozellik-bayraklari/okuma/OzellikBayragiAktifMiSunucu';
import type { PolitikaKodu } from '../icerik/PolitikaMetinleri';

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
    return { ok: false as const, hata: 'Politikalar şu an kapalı.' };
  }
  const { error } = await supabase.rpc('politika_kabul_et', {
    p_policy_version_id: policyVersionId,
  });
  if (error) return { ok: false as const, hata: error.message };
  return { ok: true as const };
}

/** Kayıt sonrası güncel zorunlu politikaları kabul kaydı */
export async function KayitPolitikaKabulKaydet(
  kodlar: PolitikaKodu[] = ['tos', 'privacy', 'child_safety'],
): Promise<void> {
  try {
    const guncel = await GuncelPolitikalariGetir();
    for (const kod of kodlar) {
      const satir = guncel.find((g) => g.policy_code === kod);
      if (satir?.id) await PolitikaKabulEt(satir.id);
    }
  } catch {
    // Sessiz — kayit engellenmesin
  }
}
