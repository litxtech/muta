import { supabase } from '../../../../lib/supabase';
import { oyunRpcRetryIle } from '../../ortak/servisler/OyunAgIstek';
import type { ConfirmResult, FruitWheelState } from '../tipler/FruitWheelTipleri';

type Fail = { ok: false; code: string };

function asState(data: unknown): FruitWheelState | Fail {
  if (!data || typeof data !== 'object') return { ok: false, code: 'empty' };
  const row = data as FruitWheelState & { code?: string };
  if (row.ok === false) return { ok: false, code: row.code ?? 'error' };
  if (!('round' in row)) return { ok: false, code: 'empty' };
  return row;
}

let onbellek: FruitWheelState | null = null;

export function fruitWheelOnbellek(): FruitWheelState | null {
  return onbellek;
}

/** Oda açılınca turu ısıt — çark ekranı boş beklemesin. */
export function fruitWheelIsit(): void {
  void fruitWheelSync();
}

export async function fruitWheelSync(): Promise<FruitWheelState | Fail> {
  const { data, error } = await oyunRpcRetryIle(() => supabase.rpc('fruit_wheel_sync'));
  if (error) return { ok: false, code: 'network' };
  const state = asState(data);
  if (state.ok) onbellek = state;
  return state;
}

export async function fruitWheelHeartbeat(): Promise<void> {
  await oyunRpcRetryIle(() => supabase.rpc('fruit_wheel_heartbeat')).catch(() => null);
}

export async function fruitWheelConfirm(
  roundId: string,
  idempotencyKey: string,
  items: { fruitId: string; amount: number }[],
  satinCoinOnay = false,
): Promise<ConfirmResult> {
  const { data, error } = await oyunRpcRetryIle(() =>
    supabase.rpc('fruit_wheel_confirm', {
      p_round_id: roundId,
      p_key: idempotencyKey,
      p_items: items,
      p_satin_coin_onay: satinCoinOnay,
    }),
  );
  if (error || !data) return { ok: false, code: 'network' };
  return data as ConfirmResult;
}

export type OyunCuzdani = {
  ok: boolean;
  game_coins: number;
  bonus_coins: number;
  purchased_coins: number;
  total_coins: number;
  satin_coin_ile_oyun: boolean;
  satin_coin_onayi_zorunlu: boolean;
};

/** Oyun ve satın alınan bakiyeleri ayrı ayrı döndürür (sunucu otoritesi). */
export async function fruitWheelCuzdanOzeti(): Promise<OyunCuzdani | null> {
  const { data, error } = await supabase.rpc('cuzdan_oyun_cuzdani');
  if (error || !data) return null;
  return data as OyunCuzdani;
}

export type HarcamaOnizleme = {
  ok: boolean;
  code?: string;
  from_game_coins: number;
  from_bonus_coins: number;
  from_purchased_coins: number;
  satin_coin_onayi_gerekli: boolean;
  satin_coin_izinli: boolean;
  yeterli: boolean;
  game_coins: number;
  purchased_coins: number;
  total_coins_after: number;
};

/** Bahsin hangi bakiyeden düşeceğini sunucudan önizler. */
export async function fruitWheelHarcamaOnizleme(amount: number): Promise<HarcamaOnizleme | null> {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const { data, error } = await supabase.rpc('cuzdan_oyun_harcama_onizleme', { p_amount: amount });
  if (error || !data) return null;
  return data as HarcamaOnizleme;
}

export async function fruitWheelHistory(): Promise<unknown> {
  const { data, error } = await oyunRpcRetryIle(() =>
    supabase.rpc('fruit_wheel_history', { p_limit: 30 }),
  );
  if (error) return { ok: false, code: 'network' };
  return data;
}

export function newFruitWheelIdempotencyKey(): string {
  return `fw_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}
