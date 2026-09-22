import { supabase } from '../../../lib/supabase';
import {
  YaptirimPayloadOlustur,
  type AdminOdaYaptirimGirdi,
} from '../ses-odalari/AdminSesOdasiIslemleri';

export type AdminCanliYayin = {
  id: string;
  title: string;
  mode: string;
  viewer_count: number;
  host_id: string;
  host_name: string;
  host_username?: string | null;
  started_at: string;
};

export type AdminYayinKatilimci = {
  user_id: string;
  role: string;
  display_name: string;
  username: string | null;
  is_host: boolean;
};

export type AdminYayinModerasyonSonuc = {
  ok: boolean;
  session_id: string;
  host_id: string;
  title: string | null;
  reason: string;
  targets?: string[];
  close?: Record<string, unknown>;
  sanctions?: Array<Record<string, unknown>>;
};

function rpcHata(error: { message?: string } | null): never {
  throw new Error(error?.message ?? 'Admin işlem başarısız');
}

export async function AdminCanliYayinlari(
  limit = 50,
): Promise<AdminCanliYayin[]> {
  const { data, error } = await supabase.rpc('admin_canli_yayinlar', {
    p_limit: limit,
  });
  if (error) rpcHata(error);
  return (data ?? []) as AdminCanliYayin[];
}

export async function AdminYayinKatilimcilari(
  sessionId: string,
): Promise<AdminYayinKatilimci[]> {
  const { data, error } = await supabase.rpc('admin_yayin_katilimcilari', {
    p_session_id: sessionId,
  });
  if (error) rpcHata(error);
  return (data ?? []) as AdminYayinKatilimci[];
}

/** Canlı yayını zorla bitir — feed’den düşer, izleyiciler çıkar */
export async function AdminCanliYayinKapat(
  sessionId: string,
  reason?: string,
): Promise<void> {
  const { error } = await supabase.rpc('admin_canli_yayin_kapat', {
    p_session_id: sessionId,
    p_reason: reason?.trim() || null,
  });
  if (error) rpcHata(error);
}

/** Kapat + isteğe bağlı yaptırımlar (host + seçilen izleyiciler) */
export async function AdminCanliYayinKapatVeYaptirim(
  sessionId: string,
  sanctions: AdminOdaYaptirimGirdi = {},
): Promise<AdminYayinModerasyonSonuc> {
  const { data, error } = await supabase.rpc(
    'admin_canli_yayin_kapat_ve_yaptirim',
    {
      p_session_id: sessionId,
      p_sanctions: YaptirimPayloadOlustur(sanctions),
    },
  );
  if (error) rpcHata(error);
  return data as AdminYayinModerasyonSonuc;
}
