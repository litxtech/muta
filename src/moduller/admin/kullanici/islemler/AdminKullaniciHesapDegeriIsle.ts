import { supabase } from '../../../../lib/supabase';

export type AdminHesapDegeriIslem = 'artir' | 'eksilt' | 'sabitle' | 'formul';

export type AdminHesapDegeriIsleSonuc =
  | {
      ok: true;
      user_id: string;
      display_name?: string;
      islem: AdminHesapDegeriIslem;
      value_before: number;
      value_after: number;
      label: string;
      override: boolean;
    }
  | { ok: false; hata: string };

export async function AdminKullaniciHesapDegeriIsle(girdi: {
  userRef: string;
  islem: AdminHesapDegeriIslem;
  miktar?: number;
  not?: string;
}): Promise<AdminHesapDegeriIsleSonuc> {
  if (!girdi.userRef.trim()) return { ok: false, hata: 'Kullanıcı gerekli' };

  const miktar =
    girdi.islem === 'formul'
      ? 0
      : Math.floor(Number(girdi.miktar ?? 0));

  if (girdi.islem !== 'formul') {
    if (!Number.isFinite(miktar)) {
      return { ok: false, hata: 'Geçerli miktar gir' };
    }
    if (girdi.islem === 'sabitle') {
      if (miktar < 0 || miktar > 1000) {
        return { ok: false, hata: 'Skor 0–1000 olmalı' };
      }
    } else if (miktar <= 0) {
      return { ok: false, hata: 'Miktar pozitif olmalı' };
    }
  }

  const { data, error } = await supabase.rpc(
    'admin_kullanici_hesap_degeri_isle',
    {
      p_user_ref: girdi.userRef.trim(),
      p_islem: girdi.islem,
      p_miktar: miktar,
      p_not: girdi.not?.trim() || null,
    },
  );

  if (error) return { ok: false, hata: error.message };
  const row = data as Record<string, unknown> | null;
  if (!row || row.ok === false) {
    return { ok: false, hata: 'İşlem başarısız' };
  }

  return {
    ok: true,
    user_id: String(row.user_id),
    display_name:
      row.display_name != null ? String(row.display_name) : undefined,
    islem: (row.islem as AdminHesapDegeriIslem) ?? girdi.islem,
    value_before: Number(row.value_before ?? 0),
    value_after: Number(row.value_after ?? 0),
    label: String(row.label ?? ''),
    override: row.override === true,
  };
}

export function AdminHesapDegeriIslemEtiketi(
  islem: AdminHesapDegeriIslem,
): string {
  if (islem === 'artir') return 'Hesap değeri artır';
  if (islem === 'eksilt') return 'Hesap değeri eksilt';
  if (islem === 'sabitle') return 'Hesap değeri sabitle';
  return 'Formülden yenile';
}
