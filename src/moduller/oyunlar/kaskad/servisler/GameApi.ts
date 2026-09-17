/**
 * Realm of Storms API — Edge Function üzerinden server sonucu.
 * Client sonucu asla üretmez; sadece ister, doğrular, oynatır.
 * Ağ kopsa bile aynı idempotency anahtarıyla retry + round kurtarma.
 */

import { supabase } from '../../../../lib/supabase';
import { DEFAULT_MATH_CONFIG } from '../sabitler/KaskadSabitleri';
import type {
  KaskadMathConfig,
  KaskadSpinRequest,
  SpinResult,
} from '../tipler/KaskadTipleri';
import type { KaskadMusicCatalog, KaskadMusicTrack } from '../ses/GameAudioManager';
import {
  oyunEdgeJsonCagir,
  oyunHataKullaniciMesaji,
  oyunRpcRetryIle,
} from '../../ortak/servisler/OyunAgIstek';

export type SpinApiError = {
  ok: false;
  hata: string;
  code?: string;
  retryable?: boolean;
};

export type SpinApiOk = {
  ok: true;
  data: SpinResult;
};

export type UnfinishedRound = {
  roundId: string;
  result: SpinResult;
  status: 'pending_playback' | 'settled';
};

/** Server payload'ını normalize et — yeni alanlar için güvenli default */
function mapResult(raw: Record<string, unknown>): SpinResult {
  const r = raw as unknown as SpinResult;
  return {
    ...r,
    retriggered: r.retriggered === true,
    retriggerSpins: Number(r.retriggerSpins ?? 0),
    persistentMultiplierBefore: Number(r.persistentMultiplierBefore ?? 0),
    persistentMultiplierAfter: Number(r.persistentMultiplierAfter ?? 0),
    scatterCount: Number(r.scatterCount ?? 0),
    isBonusSpin: r.isBonusSpin === true,
  };
}

export type KaskadGameStatus = {
  gamePaused: boolean;
  maintenance: boolean;
  maintenanceMessage: string;
};

const DEFAULT_STATUS: KaskadGameStatus = {
  gamePaused: false,
  maintenance: false,
  maintenanceMessage: '',
};

export type KaskadConfigResult = {
  config: KaskadMathConfig;
  durum: KaskadGameStatus;
  muzik: KaskadMusicCatalog;
};

const DEFAULT_MUZIK: KaskadMusicCatalog = {
  mode: 'builtin',
  loop: true,
  tracks: [],
};

function mapMusicTrack(raw: Record<string, unknown>): KaskadMusicTrack | null {
  const publicUrl = String(raw.publicUrl ?? raw.public_url ?? '').trim();
  if (!publicUrl) return null;
  return {
    id: String(raw.id ?? ''),
    title: String(raw.title ?? 'Parça'),
    publicUrl,
    mimeType: (raw.mimeType ?? raw.mime_type ?? null) as string | null,
    fileExt: (raw.fileExt ?? raw.file_ext ?? null) as string | null,
    durationMs:
      raw.durationMs != null || raw.duration_ms != null
        ? Number(raw.durationMs ?? raw.duration_ms)
        : null,
    sortOrder: Number(raw.sortOrder ?? raw.sort_order ?? 0),
    aktif: raw.aktif !== false,
  };
}

function mapMusicCatalog(raw: unknown): KaskadMusicCatalog {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_MUZIK };
  const o = raw as Record<string, unknown>;
  const mode = o.mode === 'playlist' ? 'playlist' : 'builtin';
  const tracksRaw = Array.isArray(o.tracks) ? o.tracks : [];
  const tracks = tracksRaw
    .map((t) =>
      t && typeof t === 'object'
        ? mapMusicTrack(t as Record<string, unknown>)
        : null,
    )
    .filter((t): t is KaskadMusicTrack => t != null);
  return {
    mode,
    loop: o.loop !== false,
    tracks,
  };
}

export async function fetchKaskadConfig(): Promise<KaskadConfigResult> {
  const { data, error } = await oyunRpcRetryIle(() =>
    supabase.rpc('kozmik_kaskad_aktif_config'),
  );
  if (error || !data) {
    return {
      config: DEFAULT_MATH_CONFIG,
      durum: DEFAULT_STATUS,
      muzik: DEFAULT_MUZIK,
    };
  }
  const partial = data as Partial<KaskadMathConfig> & {
    durum?: Partial<KaskadGameStatus>;
    muzik?: unknown;
  };
  const { durum, muzik, ...rest } = partial;
  return {
    config: {
      ...DEFAULT_MATH_CONFIG,
      ...rest,
      bonus: { ...DEFAULT_MATH_CONFIG.bonus, ...(rest.bonus ?? {}) },
    },
    durum: {
      gamePaused: durum?.gamePaused === true,
      maintenance: durum?.maintenance === true,
      maintenanceMessage: durum?.maintenanceMessage ?? '',
    },
    muzik: mapMusicCatalog(muzik),
  };
}

async function recoverSpinByKey(idempotencyKey: string): Promise<SpinResult | null> {
  const { data, error } = await oyunRpcRetryIle(() =>
    supabase.rpc('kozmik_kaskad_round_by_idempotency', {
      p_key: idempotencyKey,
    }),
  );
  if (error || !data) {
    const unfinished = await restoreUnfinishedKaskadRound();
    return unfinished?.result ?? null;
  }
  const row = data as {
    round_id?: string;
    result_snapshot?: Record<string, unknown>;
  };
  if (!row.result_snapshot) return null;
  return mapResult(row.result_snapshot);
}

export async function requestKaskadSpin(
  req: KaskadSpinRequest,
): Promise<SpinApiOk | SpinApiError> {
  const idempotencyKey = req.idempotencyKey || newKaskadIdempotencyKey();

  const cagri = await oyunEdgeJsonCagir('kozmik-kaskad-spin', {
    betAmount: req.betAmount,
    idempotencyKey,
    roomId: req.roomId ?? null,
    adminTest: req.adminTest === true,
  });

  if (!('data' in cagri)) {
    if (cagri.retryable || cagri.code === 'network' || cagri.code === 'internal') {
      const recovered = await recoverSpinByKey(idempotencyKey);
      if (recovered) return { ok: true, data: recovered };
    }
    return {
      ok: false,
      hata: oyunHataKullaniciMesaji(cagri.hata, cagri.code),
      code: cagri.code,
      retryable: cagri.retryable,
    };
  }

  const payload = cagri.data as {
    error?: string;
    code?: string;
    result?: Record<string, unknown>;
  } | null;

  if (payload?.error || !payload?.result) {
    if (payload?.error) {
      const recovered = await recoverSpinByKey(idempotencyKey);
      if (recovered) return { ok: true, data: recovered };
    }
    return {
      ok: false,
      hata: oyunHataKullaniciMesaji(
        payload?.error ?? 'Sunucu sonucu boş',
        payload?.code,
      ),
      code: payload?.code,
      retryable: !payload?.code || payload.code === 'internal',
    };
  }

  return { ok: true, data: mapResult(payload.result) };
}

export async function warmupKaskadSpin(): Promise<void> {
  try {
    await oyunEdgeJsonCagir(
      'kozmik-kaskad-spin',
      { ping: true },
      { deneme: 2, timeoutMs: 6_000 },
    );
  } catch {
    /* ısındırma oyunu kilitlemesin */
  }
}

export async function restoreUnfinishedKaskadRound(): Promise<UnfinishedRound | null> {
  const { data, error } = await oyunRpcRetryIle(() =>
    supabase.rpc('kozmik_kaskad_unfinished_round'),
  );
  if (error || !data) return null;
  const row = data as {
    round_id: string;
    result_snapshot: Record<string, unknown>;
    status: string;
  };
  if (!row.result_snapshot) return null;
  const result = mapResult(row.result_snapshot);
  // Eski math versiyonuyla üretilmiş snapshot yeni sembol setiyle oynatılamaz
  if (!result.mathVersion?.startsWith('storm')) return null;
  return {
    roundId: row.round_id,
    result,
    status: row.status === 'settled' ? 'settled' : 'pending_playback',
  };
}

export async function markKaskadRoundPlayed(roundId: string): Promise<void> {
  if (!roundId) return;
  const { error } = await oyunRpcRetryIle(() =>
    supabase.rpc('kozmik_kaskad_mark_played', { p_round_id: roundId }),
  );
  if (error) {
    /* oynatma işareti kaybı sonraki açılışta recover eder */
  }
}

export function newKaskadIdempotencyKey(): string {
  const rastgele =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  return `kaskad_spin_${rastgele}`;
}
