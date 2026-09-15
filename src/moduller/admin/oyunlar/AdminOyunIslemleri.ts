import { supabase } from '../../../lib/supabase';
import type { GameControlConfig } from '../../oyunlar/ortak/tipler/OyunTipleri';

export async function AdminOyunKontrolGetir(
  gameCode = 'match3',
): Promise<GameControlConfig | null> {
  const { data, error } = await supabase
    .from('game_control_configs')
    .select('*')
    .eq('game_code', gameCode)
    .maybeSingle();
  if (error) throw error;
  return data as GameControlConfig | null;
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

export async function AdminAktifOyunOturumlari(limit = 20) {
  const { data, error } = await supabase
    .from('game_sessions')
    .select('id, game_code, room_id, status, created_at, started_at, ends_at, max_players')
    .in('status', ['waiting', 'countdown', 'playing'])
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
