import { supabase } from '../../../lib/supabase';
import type { GameControlConfig } from '../../oyunlar/ortak/tipler/OyunTipleri';
import {
  AdminKillSwitchAyarla,
  AdminOzellikBayragiAyarla,
  AdminBayraklariGetir,
} from '../platform/AdminPlatformIslemleri';

export type AdminOyunKatalogSatiri = {
  game_code: string;
  name: string;
  is_active: boolean;
};

/** Oyun kodu → özellik bayrağı (senkron tutmak için). */
export const OYUN_BAYRAK_ANAHTARI: Record<string, string> = {
  kozmik_kaskad: 'kozmik_kaskad_enabled',
  zeus: 'zeus_enabled',
  nox_reels: 'nox_reels_enabled',
};

export async function AdminOyunKontrolGetir(
  gameCode = 'kozmik_kaskad',
): Promise<GameControlConfig | null> {
  const { data, error } = await supabase
    .from('game_control_configs')
    .select('*')
    .eq('game_code', gameCode)
    .maybeSingle();
  if (error) throw error;
  return data as GameControlConfig | null;
}

/** Tüm oyun kontrol config'leri — admin aç/kapa listesi. */
export async function AdminTumOyunKontrolleriniGetir(): Promise<GameControlConfig[]> {
  const { data, error } = await supabase
    .from('game_control_configs')
    .select('*')
    .order('game_code', { ascending: true });
  if (error) throw error;
  return (data as GameControlConfig[]) ?? [];
}

export async function AdminOyunKataloguGetir(): Promise<AdminOyunKatalogSatiri[]> {
  const { data, error } = await supabase
    .from('game_catalog')
    .select('game_code, name, is_active')
    .order('game_code', { ascending: true });
  if (error) throw error;
  return (data as AdminOyunKatalogSatiri[]) ?? [];
}

export async function AdminOyunKontrolGuncelle(params: {
  gameCode: string;
  patch: Record<string, unknown>;
  reason?: string;
}): Promise<GameControlConfig> {
  const { data, error } = await supabase.rpc('admin_oyun_kontrol_guncelle', {
    p_game_code: params.gameCode,
    p_patch: params.patch,
    p_reason: params.reason ?? null,
  });
  if (error) throw error;
  return data as GameControlConfig;
}

/** Tek oyunu uygulamada göster / gizle (+ eşleşen feature flag). */
export async function AdminOyunGorunurlukAyarla(
  gameCode: string,
  acik: boolean,
): Promise<GameControlConfig> {
  const patch = acik
    ? { is_enabled: true, mode: 'NORMAL' }
    : { is_enabled: false, mode: 'MAINTENANCE' };

  const next = await AdminOyunKontrolGuncelle({
    gameCode,
    patch,
    reason: acik ? 'admin: oyun açıldı' : 'admin: oyun kapatıldı',
  });

  const bayrak = OYUN_BAYRAK_ANAHTARI[gameCode];
  if (bayrak) {
    try {
      await AdminOzellikBayragiAyarla(bayrak, acik);
    } catch {
      // bayrak yoksa sessiz — asıl kontrol game_control_configs
    }
  }

  return next;
}

/** Tüm oyun butonlarını platform seviyesinde aç/kapa. */
export async function AdminOyunPlatformAyarla(acik: boolean): Promise<void> {
  await AdminOzellikBayragiAyarla('games_enabled', acik);
  if (!acik) {
    await AdminKillSwitchAyarla(
      'kill_games',
      true,
      'admin panel: tüm oyunlar kapalı',
    );
  } else {
    await AdminKillSwitchAyarla(
      'kill_games',
      false,
      'admin panel: oyunlar açıldı',
    );
  }
}

export async function AdminOyunPlatformDurumu(): Promise<{
  gamesEnabled: boolean;
  killGames: boolean;
}> {
  const { flags, kills } = await AdminBayraklariGetir();
  const gamesEnabled =
    flags.find((f) => f.key === 'games_enabled')?.enabled ?? true;
  const killGames = kills.find((k) => k.key === 'kill_games')?.active ?? false;
  return { gamesEnabled, killGames };
}

export async function AdminAktifOyunOturumlari(limit = 20) {
  const { data, error } = await supabase
    .from('game_sessions')
    .select(
      'id, game_code, room_id, status, created_at, started_at, ends_at, max_players',
    )
    .in('status', ['waiting', 'countdown', 'playing'])
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
