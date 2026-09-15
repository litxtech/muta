import { supabase } from '../../../lib/supabase';
import { OzellikBayragiAktifMiSunucu } from '../../ozellik-bayraklari/okuma/OzellikBayragiAktifMiSunucu';
import { UlkeKodunaNormalizeEt } from '../../../ortak/ulke/UlkeKodunaNormalizeEt';

export async function AjansBasvurusuOlustur(input: {
  agencyName: string;
  country?: string;
  email?: string;
  phone?: string;
  experience?: string;
  expectedHosts?: number;
  description?: string;
}): Promise<{ ok: boolean; hata?: string }> {
  if (!(await OzellikBayragiAktifMiSunucu('agency_enabled'))) {
    return { ok: false, hata: 'Ajans özelliği kapalı (agency_enabled).' };
  }
  const countryRaw = input.country?.trim() ?? '';
  // Ajans tablosu serbest metin tutabilir; bilinen adları ISO koda çevir (Türkiye → TR)
  const country =
    UlkeKodunaNormalizeEt(countryRaw) ?? (countryRaw || null);
  const { error } = await supabase.rpc('ajans_basvurusu_olustur', {
    p_agency_name: input.agencyName,
    p_country: country,
    p_email: input.email ?? null,
    p_phone: input.phone ?? null,
    p_experience: input.experience ?? null,
    p_expected_hosts: input.expectedHosts ?? null,
    p_description: input.description ?? null,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}

export async function AjansCoinTransfer(input: {
  agencyId: string;
  toUserId: string;
  coins: number;
  idempotencyKey: string;
}): Promise<{ ok: boolean; hata?: string }> {
  const { error } = await supabase.rpc('ajans_coin_transfer', {
    p_agency_id: input.agencyId,
    p_to_user_id: input.toUserId,
    p_coins: input.coins,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}
