import { supabase } from '../../../../lib/supabase';
import type { AdminKullaniciDosyasi, AdminKullaniciOzet } from '../tipler';
import { TakipServisi } from '../../../takip/islemler/TakipServisi';
import type { AdminTakipIstatistikleri } from '../../../takip/TakipTipleri';

export type AdminPolitikaKabul = {
  accepted_at: string;
  policy_version_id: string;
  policy_code: string;
  policy_version: number;
  title: string;
  description?: string;
  is_required?: boolean;
};

export type AdminCocukKorumaBeyani = {
  status: 'approved' | 'declined' | null;
  decided_at: string | null;
  locale?: string | null;
  app_version?: string | null;
};

export type AdminKullaniciPolitikaKabulleri = {
  ok: boolean;
  kabuller: AdminPolitikaKabul[];
  cocuk_koruma: AdminCocukKorumaBeyani;
};

export async function AdminKullaniciAra(
  q?: string,
  limit = 80,
): Promise<AdminKullaniciOzet[]> {
  const { data, error } = await supabase.rpc('admin_kullanici_ara', {
    p_q: q?.trim() || null,
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as AdminKullaniciOzet[];
}

export async function AdminKullaniciDosyasiGetir(
  userId: string,
): Promise<AdminKullaniciDosyasi> {
  const { data, error } = await supabase.rpc('admin_kullanici_dosyasi', {
    p_user_id: userId,
  });
  if (error) throw error;
  return data as AdminKullaniciDosyasi;
}

export async function AdminTakipIstatistikGetir(
  userId: string,
): Promise<AdminTakipIstatistikleri | null> {
  return TakipServisi.adminIstatistik(userId);
}

export async function AdminKullaniciPolitikaKabulleriGetir(
  userId: string,
): Promise<AdminKullaniciPolitikaKabulleri> {
  const { data, error } = await supabase.rpc(
    'admin_kullanici_politika_kabulleri',
    { p_user_id: userId },
  );
  if (error) throw error;
  const row = (data ?? {}) as Partial<AdminKullaniciPolitikaKabulleri>;
  return {
    ok: row.ok !== false,
    kabuller: Array.isArray(row.kabuller)
      ? (row.kabuller as AdminPolitikaKabul[])
      : [],
    cocuk_koruma: {
      status: (row.cocuk_koruma?.status as AdminCocukKorumaBeyani['status']) ?? null,
      decided_at: row.cocuk_koruma?.decided_at ?? null,
      locale: row.cocuk_koruma?.locale ?? null,
      app_version: row.cocuk_koruma?.app_version ?? null,
    },
  };
}
