import { supabase } from '../../../lib/supabase';

export type AjansLimitler = {
  single_transfer_limit: number;
  daily_limit: number;
  monthly_limit: number;
  per_user_limit: number;
  unlimited?: boolean;
  updated_at?: string;
};

export type AjansOdemeSablonu = {
  account_holder: string;
  bank_name: string;
  iban: string;
  phone: string;
  note: string;
  updated_at?: string;
};

export type AjansKurallar = {
  body: string;
  updated_at?: string;
};

export type AjansYonetimOzet = {
  id: string;
  agency_public_id: string;
  name: string;
  status: string;
  is_coin_distributor: boolean;
  invite_code: string | null;
  host_count: number;
  level_code: string | null;
};

export type AjansPanelDetay = {
  agency: {
    id: string;
    agency_public_id: string;
    name: string;
    country: string | null;
    status: string;
    trust_tier: string;
    level_code: string | null;
    is_coin_distributor: boolean;
    host_count: number;
    owner_id: string;
    invite_code: string | null;
    created_at: string;
    description?: string | null;
  };
  owner: {
    id: string;
    display_name: string | null;
    username: string | null;
    public_user_id: string | null;
    avatar_url?: string | null;
  } | null;
  wallet: {
    distribution_balance: number;
    diamonds: number;
    updated_at?: string;
  } | null;
  limits: AjansLimitler | null;
  rules: AjansKurallar | null;
  payment_template: AjansOdemeSablonu | null;
  kullanim: {
    gunluk_transfer: number;
    aylik_transfer: number;
  };
  son_transferler: Array<{
    id: string;
    to_user_id: string;
    coins: number;
    status: string;
    created_at: string;
    to_name?: string | null;
    to_username?: string | null;
    to_public_id?: string | null;
  }>;
  bekleyen_basvurular?: Array<{
    id: string;
    agency_name: string;
    status: string;
    created_at: string;
    applicant_id: string;
  }>;
};

export type AdminAjansOzet = {
  id: string;
  agency_public_id: string;
  name: string;
  country: string | null;
  status: string;
  trust_tier: string;
  level_code: string | null;
  is_coin_distributor: boolean;
  host_count: number;
  owner_id: string;
  invite_code: string | null;
  created_at: string;
  distribution_balance: number;
  diamonds: number;
  owner: {
    display_name: string | null;
    username: string | null;
    public_user_id: string | null;
  } | null;
  limits: AjansLimitler;
};

export type AdminAjansBasvuru = {
  id: string;
  agency_name: string;
  country: string | null;
  email: string | null;
  phone: string | null;
  experience: string | null;
  status: string;
  created_at: string;
  applicant_id: string;
  applicant_name: string | null;
  applicant_username: string | null;
  expected_hosts: number | null;
  description: string | null;
};

function rpcHata(error: { message?: string } | null): never {
  throw new Error(error?.message ?? 'Ajans işlem başarısız');
}

export async function AjansPanelDetayGetir(
  agencyId: string,
): Promise<AjansPanelDetay> {
  const { data, error } = await supabase.rpc('ajans_panel_detay', {
    p_agency_id: agencyId,
  });
  if (error) rpcHata(error);
  return data as AjansPanelDetay;
}

export async function AdminAjansListesi(limit = 50): Promise<AdminAjansOzet[]> {
  const { data, error } = await supabase.rpc('admin_ajans_listesi', {
    p_limit: limit,
  });
  if (error) rpcHata(error);
  return (data as AdminAjansOzet[]) ?? [];
}

export async function AdminAjansBasvuruListesi(
  limit = 40,
): Promise<AdminAjansBasvuru[]> {
  const { data, error } = await supabase.rpc('admin_ajans_basvuru_listesi', {
    p_limit: limit,
  });
  if (error) rpcHata(error);
  return (data as AdminAjansBasvuru[]) ?? [];
}

export async function AdminAjansCoinYukle(input: {
  agencyId: string;
  delta: number;
  reason?: string;
}): Promise<{ ok: boolean; distribution_balance?: number; hata?: string }> {
  const { data, error } = await supabase.rpc('admin_ajans_coin_yukle', {
    p_agency_id: input.agencyId,
    p_delta: input.delta,
    p_reason: input.reason ?? 'admin_agency_topup',
  });
  if (error) return { ok: false, hata: error.message };
  const d = data as { distribution_balance?: number };
  return { ok: true, distribution_balance: d?.distribution_balance };
}

export async function AdminAjansLimitSet(input: {
  agencyId: string;
  single: number;
  daily: number;
  monthly: number;
  perUser: number;
  unlimited?: boolean;
}): Promise<{ ok: boolean; hata?: string }> {
  const { error } = await supabase.rpc('admin_ajans_limit_set', {
    p_agency_id: input.agencyId,
    p_single: input.single,
    p_daily: input.daily,
    p_monthly: input.monthly,
    p_per_user: input.perUser,
    p_unlimited: input.unlimited ?? false,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}

export async function AjansYonetimAjanslarim(): Promise<AjansYonetimOzet[]> {
  const { data, error } = await supabase.rpc('ajans_yonetim_ajanslarim');
  if (error) rpcHata(error);
  return (data as AjansYonetimOzet[]) ?? [];
}

export async function AjansKurallariKaydet(input: {
  agencyId: string;
  body: string;
}): Promise<{ ok: boolean; hata?: string }> {
  const { error } = await supabase.rpc('ajans_kurallari_kaydet', {
    p_agency_id: input.agencyId,
    p_body: input.body,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}

export async function AjansOdemeSablonuKaydet(input: {
  agencyId: string;
  accountHolder: string;
  bankName: string;
  iban: string;
  phone?: string;
  note?: string;
}): Promise<{ ok: boolean; hata?: string }> {
  const { error } = await supabase.rpc('ajans_odeme_sablonu_kaydet', {
    p_agency_id: input.agencyId,
    p_account_holder: input.accountHolder,
    p_bank_name: input.bankName,
    p_iban: input.iban,
    p_phone: input.phone ?? '',
    p_note: input.note ?? '',
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}

export async function AjansSil(
  agencyId: string,
): Promise<{ ok: boolean; hata?: string }> {
  const { error } = await supabase.rpc('ajans_sil', {
    p_agency_id: agencyId,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}

export function AjansOdemeMesajiOlustur(
  template: AjansOdemeSablonu,
  agencyName?: string,
): string {
  const satirlar = [
    agencyName ? `${agencyName} — ödeme bilgileri` : 'Ödeme bilgileri',
    '',
    `Hesap sahibi: ${template.account_holder}`,
    `Banka: ${template.bank_name}`,
    `IBAN: ${template.iban}`,
  ];
  if (template.phone?.trim()) {
    satirlar.push(`Telefon: ${template.phone.trim()}`);
  }
  if (template.note?.trim()) {
    satirlar.push('', template.note.trim());
  }
  satirlar.push('', 'Açıklamaya kullanıcı adınızı yazın.');
  return satirlar.join('\n');
}

export async function AdminAjansDistributorAyarla(input: {
  agencyId: string;
  enabled: boolean;
  status?: string;
  trustTier?: string;
}): Promise<{ ok: boolean; hata?: string }> {
  const { error } = await supabase.rpc('admin_ajans_distributor_ayarla', {
    p_agency_id: input.agencyId,
    p_enabled: input.enabled,
    p_status: input.status ?? null,
    p_trust_tier: input.trustTier ?? null,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}

export async function AdminAjansBasvuruOnayla(
  applicationId: string,
): Promise<{ ok: boolean; agency_id?: string; hata?: string }> {
  const { data, error } = await supabase.rpc('admin_ajans_basvuru_onayla', {
    p_application_id: applicationId,
  });
  if (error) return { ok: false, hata: error.message };
  const d = data as { agency_id?: string };
  return { ok: true, agency_id: d?.agency_id };
}

export async function AdminAjansBasvuruReddet(
  applicationId: string,
  note?: string,
): Promise<{ ok: boolean; hata?: string }> {
  const { error } = await supabase.rpc('admin_ajans_basvuru_reddet', {
    p_application_id: applicationId,
    p_note: note ?? null,
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

export function LimitKalan(
  limit: number | null | undefined,
  kullanilan: number | null | undefined,
): number {
  return Math.max(0, Number(limit ?? 0) - Number(kullanilan ?? 0));
}
