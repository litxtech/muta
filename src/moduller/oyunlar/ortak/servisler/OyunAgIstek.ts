/**
 * Oyun ağı — oturum taze tutma, geçici hata retry, kullanıcıya ham
 * Edge Function / fetch mesajı asla sızdırılmaz.
 */

import { OrtamDegiskenleri } from '../../../../yapilandirma/OrtamDegiskenleri';
import { supabase } from '../../../../lib/supabase';
import { GameLogger } from '../../cekirdek/OyunLogger';

export type OyunAgHatasi = {
  ok: false;
  hata: string;
  code: string;
  retryable: boolean;
  status?: number;
};

const GECIKEN_MS = [0, 180, 420, 800] as const;
const SPIN_TIMEOUT_MS = 8_000;
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
]);

export function oyunHataGeciciMi(
  code?: string | null,
  status?: number | null,
  ham?: string | null,
): boolean {
  if (code && KALICI_KODLAR.has(code)) return false;
  if (status === 400 || status === 401 || status === 403) {
    if (code === 'auth') return true;
    if (code && KALICI_KODLAR.has(code)) return false;
    if (status === 400 && code && code !== 'network' && code !== 'settle') {
      return false;
    }
  }
  const t = (ham ?? '').toLowerCase();
  if (
    /insufficient|yetersiz|bakımda|bakimda|durduruldu|limit|bet out of range|bet not allowed/i.test(
      t,
    )
  ) {
    return false;
  }
  return true;
}

export function oyunHataKullaniciMesaji(
  ham?: string | null,
  code?: string | null,
): string {
  const c = (code ?? '').trim();
  if (c === 'insufficient_balance') return 'Yetersiz bakiye';
  if (c === 'paused') return 'Oyun kısa süre duraklatıldı';
  if (c === 'maintenance') return 'Oyun kısa süreliğine bakımda';
  if (c === 'bet' || c === 'bet_range' || c === 'bet_preset') {
    return 'Bu bahis şu an kabul edilmiyor';
  }
  if (c === 'daily_rounds') return 'Günlük oyun hakkı doldu';
  if (c === 'daily_wager') return 'Günlük bahis limiti doldu';
  if (c === 'daily_loss') return 'Günlük kayıp limitine ulaşıldı';
  if (c === 'auth') return 'Oturum yenileniyor';
  if (c === 'feature_disabled' || c === 'games_disabled') {
    return 'Oyun şu an kapalı';
  }

  const t = (ham ?? '').trim();
  if (!t) return 'Bağlantı yenileniyor';
  if (
    /failed to send|edge function|non-2xx|functionsfetch|functionshttp|functionsrelay|network request failed|timeout|abort|failed to fetch|load failed/i.test(
      t,
    )
  ) {
    return 'Bağlantı yenileniyor';
  }
  if (/insufficient coins|insufficient/i.test(t)) return 'Yetersiz bakiye';
  if (/oyun bakımda|bakımda|maintenance/i.test(t)) {
    return t.length < 80 ? t : 'Oyun kısa süreliğine bakımda';
  }
  if (/durduruldu|paused/i.test(t)) return 'Oyun kısa süre duraklatıldı';
  if (/günlük oyun limiti/i.test(t)) return 'Günlük oyun hakkı doldu';
  if (/günlük bahis/i.test(t)) return 'Günlük bahis limiti doldu';
  if (/günlük kayıp/i.test(t)) return 'Günlük kayıp limitine ulaşıldı';
  if (/unauthorized|jwt|session/i.test(t)) return 'Oturum yenileniyor';
  if (t.length > 140) return 'Şu an tamamlanamadı, yeniden deneniyor';
  return t;
}

export function oyunSettleKod(mesaj?: string | null): string {
  const t = (mesaj ?? '').toLowerCase();
  if (/insufficient/i.test(t)) return 'insufficient_balance';
  if (/bakımda|bakimda|maintenance/i.test(t)) return 'maintenance';
  if (/durduruldu|paused/i.test(t)) return 'paused';
  if (/günlük oyun limiti/i.test(t)) return 'daily_rounds';
  if (/günlük bahis/i.test(t)) return 'daily_wager';
  if (/günlük kayıp/i.test(t)) return 'daily_loss';
  if (/disabled|kill_games|feature/i.test(t)) return 'feature_disabled';
  if (/bet/i.test(t)) return 'bet';
  return 'settle';
}

export async function oyunAccessTokenAl(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    let session = data.session;
    if (!session?.access_token) return null;
    const kalanMs = (session.expires_at ?? 0) * 1000 - Date.now();
    if (kalanMs < 120_000) {
      const yenile = await supabase.auth.refreshSession();
      session = yenile.data.session ?? session;
    }
    return session?.access_token ?? null;
  } catch (e) {
    GameLogger.warn('oyunAccessTokenAl', {
      hata: e instanceof Error ? e.message : 'token',
    });
    return null;
  }
}

function bekle(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function oyunRetryIle<T>(
  is: () => Promise<T>,
  opts?: {
    deneme?: number;
    geciciMi?: (err: unknown) => boolean;
  },
): Promise<T> {
  const max = opts?.deneme ?? 4;
  let son: unknown;
  for (let i = 0; i < max; i++) {
    try {
      return await is();
    } catch (e) {
      son = e;
      const gecici = opts?.geciciMi ? opts.geciciMi(e) : true;
      if (!gecici || i === max - 1) throw e;
      await bekle(GECIKEN_MS[Math.min(i + 1, GECIKEN_MS.length - 1)] ?? 400);
    }
  }
  throw son;
}

type JsonBody = Record<string, unknown>;

export async function oyunEdgeJsonCagir(
  fonksiyon: string,
  body: JsonBody,
  opts?: { timeoutMs?: number; deneme?: number },
): Promise<{ data: JsonBody | null } | OyunAgHatasi> {
  const url = `${OrtamDegiskenleri.supabaseUrl.replace(/\/$/, '')}/functions/v1/${fonksiyon}`;
  const deneme = opts?.deneme ?? 3;
  const timeoutMs = opts?.timeoutMs ?? SPIN_TIMEOUT_MS;

  let token = await oyunAccessTokenAl();
  if (!token) {
    return {
      ok: false,
      hata: 'Oturum yenileniyor',
      code: 'auth',
      retryable: true,
    };
  }

  let son: OyunAgHatasi | null = null;

  for (let i = 0; i < deneme; i++) {
    if (i > 0) {
      await bekle(GECIKEN_MS[Math.min(i, GECIKEN_MS.length - 1)] ?? 400);
      const taze = await oyunAccessTokenAl();
      if (taze) token = taze;
    }

    const denetleyici = new AbortController();
    const zamanlayici = setTimeout(() => denetleyici.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: OrtamDegiskenleri.supabaseAnonAnahtari,
        },
        body: JSON.stringify(body),
        signal: denetleyici.signal,
      });
      const ham = await res.text();
      let json: JsonBody | null = null;
      if (ham) {
        try {
          json = JSON.parse(ham) as JsonBody;
        } catch {
          json = null;
        }
      }

      if (res.status === 401 || (json && json.code === 'auth')) {
        await supabase.auth.refreshSession().catch(() => null);
        son = {
          ok: false,
          hata: oyunHataKullaniciMesaji(
            typeof json?.error === 'string' ? json.error : ham,
            'auth',
          ),
          code: 'auth',
          retryable: true,
          status: res.status,
        };
        continue;
      }

      if (json && typeof json.error === 'string') {
        const code = String(json.code ?? (res.ok ? 'error' : 'network'));
        const retryable = oyunHataGeciciMi(code, res.status, json.error);
        const hata = oyunHataKullaniciMesaji(json.error, code);
        if (retryable && i < deneme - 1) {
          son = { ok: false, hata, code, retryable, status: res.status };
          continue;
        }
        return { ok: false, hata, code, retryable, status: res.status };
      }

      if (!res.ok) {
        const retryable = oyunHataGeciciMi('network', res.status, ham);
        const hata = oyunHataKullaniciMesaji(ham, 'network');
        if (retryable && i < deneme - 1) {
          son = {
            ok: false,
            hata,
            code: 'network',
            retryable: true,
            status: res.status,
          };
          continue;
        }
        return {
          ok: false,
          hata,
          code: 'network',
          retryable,
          status: res.status,
        };
      }

      return { data: json };
    } catch (e) {
      const ham =
        e instanceof Error
          ? e.name === 'AbortError'
            ? 'timeout'
            : e.message
          : 'fetch';
      son = {
        ok: false,
        hata: oyunHataKullaniciMesaji(ham, 'network'),
        code: 'network',
        retryable: true,
      };
      GameLogger.warn('oyunEdgeJsonCagir', {
        fonksiyon,
        deneme: i + 1,
        hata: ham,
      });
    } finally {
      clearTimeout(zamanlayici);
    }
  }

  return (
    son ?? {
      ok: false,
      hata: 'Bağlantı yenileniyor',
      code: 'network',
      retryable: true,
    }
  );
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
      if (!oyunHataGeciciMi('rpc', null, sonuc.error.message ?? '')) {
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
