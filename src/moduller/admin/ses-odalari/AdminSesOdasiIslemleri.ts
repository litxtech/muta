import { supabase } from '../../../lib/supabase';
import type { AdminCanliOda } from '../tipler/PlatformTipleri';

export type AdminOdaYaptirimGirdi = {
  reason?: string;
  /** Coin cezası (0 = yok) */
  coin_penalty?: number;
  /** İhtar kaydı */
  warning?: boolean;
  /** Saat; -1 = kalıcı; undefined/0 = yok */
  upload_ban_hours?: number;
  /** Saat; -1 = kalıcı; undefined/0 = yok */
  room_create_ban_hours?: number;
  account_ban?: boolean;
};

export type AdminOdaModerasyonSonuc = {
  ok: boolean;
  room_id: string;
  host_id: string;
  title: string | null;
  reason: string;
  close?: Record<string, unknown>;
  sanctions?: Array<Record<string, unknown>>;
};

function rpcHata(error: { message?: string } | null): never {
  throw new Error(error?.message ?? 'Admin işlem başarısız');
}

export async function AdminCanliSesOdalari(
  limit = 50,
): Promise<AdminCanliOda[]> {
  const { data, error } = await supabase.rpc('admin_canli_odalar', {
    p_limit: limit,
  });
  if (error) rpcHata(error);
  return (data ?? []) as AdminCanliOda[];
}

/** Sadece kapat + üyeleri dağıt (yaptırım yok) */
export async function AdminSesOdasiKapat(roomId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_oda_canli_kapat', {
    p_room_id: roomId,
  });
  if (error) rpcHata(error);
}

/** Kapat + isteğe bağlı host yaptırımları. Feed `is_live=false` ile düşer. */
export async function AdminSesOdasiKapatVeYaptirim(
  roomId: string,
  sanctions: AdminOdaYaptirimGirdi = {},
): Promise<AdminOdaModerasyonSonuc> {
  const payload: Record<string, unknown> = {
    reason: sanctions.reason?.trim() || undefined,
    warning: sanctions.warning === true,
    account_ban: sanctions.account_ban === true,
  };

  if (sanctions.coin_penalty && sanctions.coin_penalty > 0) {
    payload.coin_penalty = Math.floor(sanctions.coin_penalty);
  }
  if (
    sanctions.upload_ban_hours !== undefined &&
    sanctions.upload_ban_hours !== 0
  ) {
    payload.upload_ban_hours = sanctions.upload_ban_hours;
  }
  if (
    sanctions.room_create_ban_hours !== undefined &&
    sanctions.room_create_ban_hours !== 0
  ) {
    payload.room_create_ban_hours = sanctions.room_create_ban_hours;
  }

  const { data, error } = await supabase.rpc(
    'admin_ses_odasi_kapat_ve_yaptirim',
    {
      p_room_id: roomId,
      p_sanctions: payload,
    },
  );
  if (error) rpcHata(error);
  return data as AdminOdaModerasyonSonuc;
}

export async function AdminYaptirimUygula(input: {
  userId: string;
  kind: 'upload_ban' | 'room_create_ban';
  hours?: number;
  reason?: string;
  roomId?: string;
}): Promise<void> {
  const { error } = await supabase.rpc('admin_yaptirim_uygula', {
    p_user_id: input.userId,
    p_kind: input.kind,
    p_hours: input.hours ?? 24,
    p_reason: input.reason ?? null,
    p_room_id: input.roomId ?? null,
  });
  if (error) rpcHata(error);
}

export async function AdminYaptirimKaldir(input: {
  sanctionId?: string;
  userId?: string;
  kind?: 'upload_ban' | 'room_create_ban';
}): Promise<void> {
  const { error } = await supabase.rpc('admin_yaptirim_kaldir', {
    p_sanction_id: input.sanctionId ?? null,
    p_user_id: input.userId ?? null,
    p_kind: input.kind ?? null,
  });
  if (error) rpcHata(error);
}

export type AktifYaptirim = {
  id: string;
  kind: 'upload_ban' | 'room_create_ban' | string;
  reason: string;
  starts_at: string;
  expires_at: string | null;
  room_id: string | null;
};

export async function BenimAktifYaptirimlarim(): Promise<AktifYaptirim[]> {
  const { data, error } = await supabase.rpc('benim_aktif_yaptirimlarim');
  if (error) return [];
  return (Array.isArray(data) ? data : []) as AktifYaptirim[];
}

export async function YaptirimAktifMi(
  kind: 'upload_ban' | 'room_create_ban',
): Promise<boolean> {
  const liste = await BenimAktifYaptirimlarim();
  return liste.some((s) => s.kind === kind);
}

export const YAPTIRIM_SURE_SECENEKLERI = [
  { label: '1 saat', hours: 1 },
  { label: '6 saat', hours: 6 },
  { label: '24 saat', hours: 24 },
  { label: '3 gün', hours: 72 },
  { label: '7 gün', hours: 168 },
  { label: 'Kalıcı', hours: -1 },
] as const;

export const COIN_CEZA_HIZLI = [1_000, 5_000, 10_000, 50_000] as const;
