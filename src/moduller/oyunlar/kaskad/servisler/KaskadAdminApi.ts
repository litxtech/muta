/**
 * Realm of Storms — Admin API.
 * Migration 081'deki admin RPC'lerine ince tip güvenli sarmalayıcılar.
 * Tüm yetki kontrolü server tarafında (ben_admin_miyim) yapılır;
 * buradaki fonksiyonlar sadece çağrı + normalize eder.
 */

import { supabase } from '../../../../lib/supabase';
import type { KaskadMathConfig } from '../tipler/KaskadTipleri';
import type { SimulationReport } from '../motor/SpinSimulator';

export type KaskadAdminStats = {
  periodDays: number;
  activePlayers: number;
  roundCount: number;
  totalWager: number;
  totalPayout: number;
  observedRtp: number;
  hitRate: number;
  bonusRate: number;
  averageBet: number;
  averageWin: number;
  averageCascades: number;
  maxWin: number;
  multiplierDistribution: Record<string, number>;
};

export type KaskadMathVersionRow = {
  mathVersion: string;
  isActive: boolean;
  createdAt: string;
  config: KaskadMathConfig;
  /** Bu versiyon için son kaydedilmiş simülasyon RTP'si (yoksa null) */
  lastSimRtp: number | null;
};

export type KaskadGameSettings = {
  gamePaused: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  minBet: number | null;
  maxBet: number | null;
  betPresets: number[] | null;
  autoplayEnabled: boolean | null;
  turboEnabled: boolean | null;
  maxDailyWager: number | null;
  maxDailyLoss: number | null;
  maxRoundsPerDay: number | null;
  musicMode: 'builtin' | 'playlist';
  musicLoop: boolean;
  updatedAt: string;
};

export type KaskadMusicTrackRow = {
  id: string;
  title: string;
  publicUrl: string;
  storagePath: string | null;
  mimeType: string | null;
  fileExt: string | null;
  durationMs: number | null;
  sortOrder: number;
  aktif: boolean;
  createdAt: string;
  updatedAt: string;
};

export type KaskadMusicAdminState = {
  mode: 'builtin' | 'playlist';
  loop: boolean;
  tracks: KaskadMusicTrackRow[];
  deletedStoragePath?: string | null;
};

export type KaskadScheduleRow = {
  id: string;
  mathVersion: string;
  startsAt: string;
  endsAt: string;
  reason: string;
  status: 'active' | 'cancelled';
  isLive: boolean;
  createdAt: string;
};

export type KaskadAdminRoundRow = {
  id: string;
  userId: string;
  status: string;
  betAmount: number;
  winAmount: number;
  totalMultiplier: number;
  mathVersion: string;
  isBonusSpin: boolean;
  createdAt: string;
};

export type KaskadAuditRow = {
  id: string;
  userId: string | null;
  adminUserId: string | null;
  action: string;
  roundId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type KaskadSimRunRow = {
  id: string;
  mathVersion: string;
  rounds: number;
  betAmount: number;
  report: SimulationReport;
  createdAt: string;
};

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export async function kaskadAdminStats(days: number): Promise<KaskadAdminStats> {
  return rpc<KaskadAdminStats>('kozmik_kaskad_admin_stats', { p_days: days });
}

export async function kaskadAdminMathList(): Promise<KaskadMathVersionRow[]> {
  return rpc<KaskadMathVersionRow[]>('kozmik_kaskad_admin_math_list', {});
}

export async function kaskadAdminMathCreate(input: {
  mathVersion: string;
  config: KaskadMathConfig;
  activate: boolean;
  reason: string;
}): Promise<{ ok: boolean; mathVersion: string; active: boolean }> {
  return rpc('kozmik_kaskad_admin_math_create', {
    p_math_version: input.mathVersion,
    p_config: input.config,
    p_activate: input.activate,
    p_reason: input.reason,
  });
}

export async function kaskadAdminMathActivate(
  mathVersion: string,
  reason: string,
): Promise<{ ok: boolean }> {
  return rpc('kozmik_kaskad_admin_math_activate', {
    p_math_version: mathVersion,
    p_reason: reason,
  });
}

export async function kaskadAdminRefund(
  roundId: string,
  reason: string,
): Promise<{ ok: boolean; refund?: number; balanceAfter?: number; error?: string }> {
  return rpc('kozmik_kaskad_admin_refund', {
    p_round_id: roundId,
    p_reason: reason,
  });
}

export async function kaskadAdminRoundList(
  limit: number,
  userId?: string,
): Promise<KaskadAdminRoundRow[]> {
  return rpc<KaskadAdminRoundRow[]>('kozmik_kaskad_admin_round_listesi', {
    p_limit: limit,
    p_user_id: userId ?? null,
  });
}

export async function kaskadAdminAuditList(limit: number): Promise<KaskadAuditRow[]> {
  return rpc<KaskadAuditRow[]>('kozmik_kaskad_admin_audit_listesi', { p_limit: limit });
}

export async function kaskadAdminSimSave(input: {
  mathVersion: string;
  rounds: number;
  betAmount: number;
  report: SimulationReport;
}): Promise<{ ok: boolean; id: string }> {
  return rpc('kozmik_kaskad_admin_sim_kaydet', {
    p_math_version: input.mathVersion,
    p_rounds: input.rounds,
    p_bet_amount: input.betAmount,
    p_report: input.report,
  });
}

export async function kaskadAdminSimList(limit: number): Promise<KaskadSimRunRow[]> {
  return rpc<KaskadSimRunRow[]>('kozmik_kaskad_admin_sim_listesi', { p_limit: limit });
}

export async function kaskadAdminSettingsGet(): Promise<KaskadGameSettings> {
  return rpc<KaskadGameSettings>('kozmik_kaskad_admin_settings_get', {});
}

export async function kaskadAdminSettingsUpdate(
  patch: Partial<KaskadGameSettings>,
  reason: string,
): Promise<KaskadGameSettings> {
  return rpc<KaskadGameSettings>('kozmik_kaskad_admin_settings_update', {
    p_patch: patch,
    p_reason: reason,
  });
}

export async function kaskadAdminScheduleList(
  limit: number,
): Promise<KaskadScheduleRow[]> {
  return rpc<KaskadScheduleRow[]>('kozmik_kaskad_admin_schedule_list', {
    p_limit: limit,
  });
}

export async function kaskadAdminScheduleCreate(input: {
  mathVersion: string;
  startsAt: string;
  endsAt: string;
  reason: string;
}): Promise<{ ok: boolean; id: string }> {
  return rpc('kozmik_kaskad_admin_schedule_create', {
    p_math_version: input.mathVersion,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_reason: input.reason,
  });
}

export async function kaskadAdminScheduleCancel(
  id: string,
  reason: string,
): Promise<{ ok: boolean }> {
  return rpc('kozmik_kaskad_admin_schedule_cancel', {
    p_id: id,
    p_reason: reason,
  });
}

function mapMusicAdminState(raw: unknown): KaskadMusicAdminState {
  const o = (raw ?? {}) as Record<string, unknown>;
  const tracksRaw = Array.isArray(o.tracks) ? o.tracks : [];
  return {
    mode: o.mode === 'playlist' ? 'playlist' : 'builtin',
    loop: o.loop !== false,
    tracks: tracksRaw.map((t) => {
      const r = (t ?? {}) as Record<string, unknown>;
      return {
        id: String(r.id ?? ''),
        title: String(r.title ?? ''),
        publicUrl: String(r.publicUrl ?? ''),
        storagePath: (r.storagePath as string | null) ?? null,
        mimeType: (r.mimeType as string | null) ?? null,
        fileExt: (r.fileExt as string | null) ?? null,
        durationMs: r.durationMs != null ? Number(r.durationMs) : null,
        sortOrder: Number(r.sortOrder ?? 0),
        aktif: r.aktif !== false,
        createdAt: String(r.createdAt ?? ''),
        updatedAt: String(r.updatedAt ?? ''),
      };
    }),
    deletedStoragePath: (o.deletedStoragePath as string | null) ?? null,
  };
}

export async function kaskadAdminMuzikList(): Promise<KaskadMusicAdminState> {
  const data = await rpc<unknown>('kozmik_kaskad_admin_muzik_list', {});
  return mapMusicAdminState(data);
}

export async function kaskadAdminMuzikEkle(input: {
  title: string;
  publicUrl: string;
  storagePath?: string | null;
  mimeType?: string | null;
  fileExt?: string | null;
  durationMs?: number | null;
  autoPlaylist?: boolean;
}): Promise<KaskadMusicAdminState> {
  const data = await rpc<unknown>('kozmik_kaskad_admin_muzik_ekle', {
    p_title: input.title,
    p_public_url: input.publicUrl,
    p_storage_path: input.storagePath ?? null,
    p_mime_type: input.mimeType ?? null,
    p_file_ext: input.fileExt ?? null,
    p_duration_ms: input.durationMs ?? null,
    p_auto_playlist: input.autoPlaylist !== false,
  });
  return mapMusicAdminState(data);
}

export async function kaskadAdminMuzikGuncelle(
  id: string,
  patch: Partial<{
    title: string;
    aktif: boolean;
    sortOrder: number;
    durationMs: number | null;
  }>,
): Promise<KaskadMusicAdminState> {
  const data = await rpc<unknown>('kozmik_kaskad_admin_muzik_guncelle', {
    p_id: id,
    p_patch: patch,
  });
  return mapMusicAdminState(data);
}

export async function kaskadAdminMuzikSil(id: string): Promise<KaskadMusicAdminState> {
  const data = await rpc<unknown>('kozmik_kaskad_admin_muzik_sil', { p_id: id });
  return mapMusicAdminState(data);
}

export async function kaskadAdminMuzikSirala(
  ids: string[],
): Promise<KaskadMusicAdminState> {
  const data = await rpc<unknown>('kozmik_kaskad_admin_muzik_sirala', {
    p_ids: ids,
  });
  return mapMusicAdminState(data);
}

export async function kaskadAdminMuzikAyar(input: {
  mode?: 'builtin' | 'playlist' | null;
  loop?: boolean | null;
  reason: string;
}): Promise<KaskadMusicAdminState> {
  const data = await rpc<unknown>('kozmik_kaskad_admin_muzik_ayar', {
    p_mode: input.mode ?? null,
    p_loop: input.loop ?? null,
    p_reason: input.reason,
  });
  return mapMusicAdminState(data);
}
