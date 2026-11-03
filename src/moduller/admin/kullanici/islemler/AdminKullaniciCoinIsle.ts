import { supabase } from '../../../../lib/supabase';

/** Cüzdan kovaları: satın alınan coin ve ödül/promosyon coin ayrı yönetilir. */
export type AdminCoinKovasi = 'coins' | 'bonus_coins';

export type AdminCoinIslem = 'topup' | 'deduct' | 'penalty';

export type AdminCoinIsleSonuc =
  | {
      ok: true;
      user_id: string;
      display_name?: string;
      islem: AdminCoinIslem;
      /** İşlemin gerçekten yazıldığı kova. */
      kova: AdminCoinKovasi;
      /** İstenen kova (topup + coins → ödül kovasına yönlendirilir). */
      istenen_kova: AdminCoinKovasi;
      /** Satın alınan kovaya ekleme istendiğinde true: kredi ödül kovasına yazıldı. */
      kova_degisti: boolean;
      /** İstenen miktar. */
      requested: number;
      /** Uygulanan miktar (bakiye yetmediyse küçük olabilir). */
      applied: number;
      /** Bakiye yetersizliğinden dolayı eksik kalan tutar. */
      shortfall: number;
      delta: number;
      balance_after: number;
      coins: number;
      bonus_coins: number;
      game_coins: number;
      currency: string;
      warning_id?: string | null;
    }
  | { ok: false; hata: string };

export async function AdminKullaniciCoinIsle(girdi: {
  userRef: string;
  islem: AdminCoinIslem;
  miktar: number;
  not?: string;
  kova?: AdminCoinKovasi;
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
    p_kova: girdi.kova ?? 'coins',
  });

  if (error) return { ok: false, hata: error.message };
  const row = data as Record<string, unknown> | null;
  if (!row || row.ok === false) {
    return { ok: false, hata: 'İşlem başarısız' };
  }

  const kova: AdminCoinKovasi =
    row.kova === 'bonus_coins' ? 'bonus_coins' : 'coins';
  const istenenKova: AdminCoinKovasi =
    row.istenen_kova === 'bonus_coins' ? 'bonus_coins' : 'coins';
  const delta = Number(row.delta ?? 0);

  return {
    ok: true,
    user_id: String(row.user_id),
    display_name: row.display_name != null ? String(row.display_name) : undefined,
    islem: (row.islem as AdminCoinIslem) ?? girdi.islem,
    kova,
    istenen_kova: istenenKova,
    kova_degisti: row.yonlendirildi === true || kova !== istenenKova,
    requested: Number(row.requested ?? miktar),
    applied: Number(row.applied ?? Math.abs(delta)),
    shortfall: Number(row.shortfall ?? 0),
    delta,
    balance_after: Number(row.balance_after ?? 0),
    coins: Number(row.coins ?? 0),
    bonus_coins: Number(row.bonus_coins ?? 0),
    game_coins: Number(row.game_coins ?? 0),
    currency: String(row.currency ?? kova),
    warning_id: row.warning_id != null ? String(row.warning_id) : null,
  };
}

export function AdminCoinKovaAdi(kova: AdminCoinKovasi): string {
  return kova === 'bonus_coins' ? 'Ödül coin' : 'Coin';
}

export function AdminCoinIslemEtiketi(
  islem: AdminCoinIslem,
  kova: AdminCoinKovasi = 'coins',
): string {
  if (islem === 'topup') {
    return kova === 'bonus_coins' ? 'Ödül coin ekleme' : 'Coin ekleme';
  }
  if (islem === 'deduct') {
    return kova === 'bonus_coins' ? 'Ödül coin eksiltme' : 'Coin eksiltme';
  }
  return kova === 'bonus_coins' ? 'Ödül coin cezası' : 'Coin cezası';
}
