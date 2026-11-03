import { supabase } from '../../../../lib/supabase';

/** Admin panelinde gösterilen cüzdan kovaları. */
export type AdminCuzdanOzeti = {
  user_id: string;
  display_name: string | null;
  /** Satın alınan coin (IAP / Stripe). Nakde çevrilebilir değer. */
  coins: number;
  /** Ödül / promosyon coin (admin, görev, hoş geldin). Nakde çevrilemez. */
  bonus_coins: number;
  /** Oyunlardan kazanılan coin. Nakde çevrilemez. */
  game_coins: number;
  diamonds: number;
  total_coins: number;
};

/**
 * Bir kullanıcının coin / ödül coin / oyun coin bakiyesini okur.
 * Eksiltme öncesi bakiye gösterimi ve onay sonrası tazeleme için kullanılır.
 */
export async function AdminKullaniciCuzdanOzetiGetir(
  userRef: string,
): Promise<AdminCuzdanOzeti | null> {
  const ref = userRef.trim();
  if (!ref) return null;

  const { data, error } = await supabase.rpc('admin_kullanici_cuzdan_ozeti', {
    p_user_ref: ref,
  });
  if (error) throw new Error(error.message);

  const row = data as Record<string, unknown> | null;
  if (!row || row.ok === false) return null;

  return {
    user_id: String(row.user_id ?? ''),
    display_name: row.display_name != null ? String(row.display_name) : null,
    coins: Number(row.coins ?? 0),
    bonus_coins: Number(row.bonus_coins ?? 0),
    game_coins: Number(row.game_coins ?? 0),
    diamonds: Number(row.diamonds ?? 0),
    total_coins: Number(row.total_coins ?? 0),
  };
}

export function CuzdanSayi(n: number | null | undefined): string {
  return Math.max(0, Math.floor(Number(n ?? 0))).toLocaleString('tr-TR');
}
