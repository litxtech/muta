import { supabase } from '../../../../lib/supabase';

export type AdminCoinIslem = 'topup' | 'deduct' | 'penalty';

export type AdminCoinIsleSonuc =
  | {
      ok: true;
      user_id: string;
      display_name?: string;
      islem: AdminCoinIslem;
      delta: number;
      balance_after: number;
      currency: string;
      warning_id?: string | null;
    }
  | { ok: false; hata: string };

export async function AdminKullaniciCoinIsle(girdi: {
  userRef: string;
  islem: AdminCoinIslem;
  miktar: number;
  not?: string;
}): Promise<AdminCoinIsleSonuc> {
  const miktar = Math.floor(Math.abs(Number(girdi.miktar)));
  if (!girdi.userRef.trim()) return { ok: false, hata: 'Kullanıcı gerekli' };
  if (!Number.isFinite(miktar) || miktar <= 0) {
    return { ok: false, hata: 'Miktar pozitif olmalı' };
  }

  const { data, error } = await supabase.rpc('admin_kullanici_coin_isle', {
    p_user_ref: girdi.userRef.trim(),
    p_islem: girdi.islem,
    p_miktar: miktar,
    p_not: girdi.not?.trim() || null,
  });

  if (error) return { ok: false, hata: error.message };
  const row = data as Record<string, unknown> | null;
  if (!row || row.ok === false) {
    return { ok: false, hata: 'İşlem başarısız' };
  }

  return {
    ok: true,
    user_id: String(row.user_id),
    display_name: row.display_name != null ? String(row.display_name) : undefined,
    islem: (row.islem as AdminCoinIslem) ?? girdi.islem,
    delta: Number(row.delta),
    balance_after: Number(row.balance_after),
    currency: String(row.currency ?? 'coins'),
    warning_id: row.warning_id != null ? String(row.warning_id) : null,
  };
}

export function AdminCoinIslemEtiketi(islem: AdminCoinIslem): string {
  if (islem === 'topup') return 'Coin yükleme';
  if (islem === 'deduct') return 'Coin eksiltme';
  return 'Coin cezası';
}
