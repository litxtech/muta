import { supabase } from '../../../lib/supabase';
import { OzellikBayragiAktifMiSunucu } from '../../ozellik-bayraklari/okuma/OzellikBayragiAktifMiSunucu';

export async function SehirAdayBasvurusu(input: {
  electionId: string;
  manifesto?: string;
}): Promise<{ ok: boolean; hata?: string }> {
  if (!(await OzellikBayragiAktifMiSunucu('city_elections_enabled'))) {
    return { ok: false, hata: 'city_elections_enabled bayrağı kapalı.' };
  }
  const { error } = await supabase.rpc('sehir_aday_basvurusu', {
    p_election_id: input.electionId,
    p_manifesto: input.manifesto ?? null,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}

export async function SehirOyuKullan(input: {
  electionId: string;
  candidateId: string;
}): Promise<{ ok: boolean; hata?: string }> {
  if (!(await OzellikBayragiAktifMiSunucu('city_elections_enabled'))) {
    return { ok: false, hata: 'city_elections_enabled bayrağı kapalı.' };
  }
  const { error } = await supabase.rpc('sehir_oyu_kullan', {
    p_election_id: input.electionId,
    p_candidate_id: input.candidateId,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}

/** Dev: secim olustur */
export async function SehirSecimOlusturDev(input: {
  cityId: string;
  title?: string;
}): Promise<{ ok: boolean; hata?: string; id?: string }> {
  const { data, error } = await supabase.rpc('sehir_secim_olustur_dev', {
    p_city_id: input.cityId,
    p_title: input.title ?? null,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true, id: (data as { id?: string } | null)?.id };
}

export async function SehirSecimiOylamayaAcDev(
  electionId: string,
): Promise<{ ok: boolean; hata?: string }> {
  const { error } = await supabase.rpc('sehir_secimi_oylamaya_ac_dev', {
    p_election_id: electionId,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}
