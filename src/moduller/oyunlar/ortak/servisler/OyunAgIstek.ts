/**
 * Oyun ağı — geçici RPC hatalarında kısa retry.
 */

const GECIKEN_MS = [0, 180, 420, 800] as const;
const RPC_TIMEOUT_MS = 8_000;

const KALICI_KODLAR = new Set([
  'insufficient_balance',
  'bet',
  'bet_range',
  'bet_preset',
  'maintenance',
  'paused',
  'idempotency',
  'daily_rounds',
  'daily_wager',
  'daily_loss',
  'feature_disabled',
  'games_disabled',
  'satin_coin_onayi_gerekli',
  'satin_coin_kapali',
]);

function oyunHataGeciciMi(code?: string | null, ham?: string | null): boolean {
  if (code && KALICI_KODLAR.has(code)) return false;
  const t = (ham ?? '').toLowerCase();
  if (/satin_coin_onay|satin_coin_kapali/.test(t)) return false;
  if (
    /insufficient|yetersiz|bakımda|bakimda|durduruldu|limit|bet out of range|bet not allowed/i.test(
      t,
    )
  ) {
    return false;
  }
  return true;
}

function bekle(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function oyunRpcRetryIle<T>(
  fn: () => unknown,
): Promise<{ data: T | null; error: { message?: string } | null }> {
  let son: { data: T | null; error: { message?: string } | null } = {
    data: null,
    error: { message: 'rpc' },
  };
  for (let i = 0; i < 3; i++) {
    if (i > 0) await bekle(GECIKEN_MS[i] ?? 300);
    try {
      const ham = await Promise.race([
        Promise.resolve(fn()),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), RPC_TIMEOUT_MS),
        ),
      ]);
      const sonuc = ham as { data: T; error: { message?: string } | null };
      if (!sonuc.error) return { data: sonuc.data ?? null, error: null };
      son = { data: sonuc.data ?? null, error: sonuc.error };
      if (!oyunHataGeciciMi('rpc', sonuc.error.message ?? '')) {
        return son;
      }
    } catch (e) {
      son = {
        data: null,
        error: { message: e instanceof Error ? e.message : 'rpc' },
      };
    }
  }
  return son;
}
