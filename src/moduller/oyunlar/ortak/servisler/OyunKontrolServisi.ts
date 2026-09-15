/**
 * Oyun kontrol servisi — aktif config + override okuma.
 */

import { supabase } from '../../../../lib/supabase';
import { GameLogger } from '../../cekirdek/OyunLogger';
import type {
  GameCode,
  GameControlConfig,
  GameControlOverride,
  RpcResult,
} from '../tipler/OyunTipleri';

export type GameControlBundle = {
  config: GameControlConfig | null;
  override: GameControlOverride | null;
};

export async function fetchGameControl(
  gameCode: GameCode,
  now: Date = new Date(),
): Promise<RpcResult<GameControlBundle>> {
  try {
    const iso = now.toISOString();

    const [configRes, overrideRes] = await Promise.all([
      supabase
        .from('game_control_configs')
        .select('*')
        .eq('game_code', gameCode)
        .eq('is_enabled', true)
        .maybeSingle(),
      supabase
        .from('game_control_overrides')
        .select('*')
        .eq('game_code', gameCode)
        .lte('starts_at', iso)
        .gte('ends_at', iso)
        .order('starts_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (configRes.error) {
      GameLogger.error('fetchGameControl config', { hata: configRes.error.message });
      return { ok: false, hata: configRes.error.message };
    }
    if (overrideRes.error) {
      GameLogger.error('fetchGameControl override', { hata: overrideRes.error.message });
      return { ok: false, hata: overrideRes.error.message };
    }

    return {
      ok: true,
      data: {
        config: (configRes.data as GameControlConfig | null) ?? null,
        override: (overrideRes.data as GameControlOverride | null) ?? null,
      },
    };
  } catch (e) {
    const hata = e instanceof Error ? e.message : 'fetchGameControl başarısız';
    GameLogger.error('fetchGameControl', { hata });
    return { ok: false, hata };
  }
}

export const OyunKontrolServisi = {
  fetchGameControl,
} as const;
