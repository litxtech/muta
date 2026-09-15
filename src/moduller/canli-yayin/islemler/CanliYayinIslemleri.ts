import { supabase } from '../../../lib/supabase';

export async function CanliYayinBaslat(input: {
  title: string;
  mode?: string;
}): Promise<{ ok: true; session: { id: string; livekit_room_name?: string } } | { ok: false; hata: string }> {
  const { data, error } = await supabase.rpc('canli_yayin_baslat', {
    p_title: input.title,
    p_mode: input.mode ?? 'solo',
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true, session: data as { id: string; livekit_room_name?: string } };
}

/** Yayini bitir (RPC). sessionId yoksa kullanicinin aktif yayinini kapatir. */
export async function CanliYayinBitir(
  sessionId?: string | null,
): Promise<{ ok: true } | { ok: false; hata: string }> {
  const { error } = await supabase.rpc('canli_yayin_bitir', {
    p_session_id: sessionId ?? null,
  });
  if (error) {
    const uid = (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return { ok: false, hata: error.message };
    let q = supabase
      .from('live_sessions')
      .update({ is_live: false, ended_at: new Date().toISOString() })
      .eq('host_id', uid)
      .eq('is_live', true);
    if (sessionId) q = q.eq('id', sessionId);
    const fallback = await q;
    if (fallback.error) return { ok: false, hata: error.message };
  }
  return { ok: true };
}

export async function CanliYayinlariGetir(limit = 20) {
  const { data, error } = await supabase
    .from('live_sessions')
    .select(
      '*, host:profiles!live_sessions_host_id_fkey(id, display_name, username, public_user_id, level, avatar_url)',
    )
    .eq('is_live', true)
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = data ?? [];
  return [...rows].sort((a: any, b: any) => {
    const sa =
      Number(b.score ?? 0) +
      Number(b.gift_count ?? 0) * 10 +
      Number(b.like_count ?? 0) * 3 -
      (Number(a.score ?? 0) +
        Number(a.gift_count ?? 0) * 10 +
        Number(a.like_count ?? 0) * 3);
    return sa;
  });
}

export async function CanliYayinBegen(
  sessionId: string,
): Promise<{ ok: true; like_count: number; first: boolean } | { ok: false; hata: string }> {
  const { data, error } = await supabase.rpc('canli_yayin_begen', {
    p_session_id: sessionId,
  });
  if (error) return { ok: false, hata: error.message };
  const row = data as { like_count?: number; first?: boolean };
  return {
    ok: true,
    like_count: Number(row?.like_count ?? 0),
    first: !!row?.first,
  };
}

export async function CanliYayinIzleyiciGir(
  sessionId: string,
): Promise<{ ok: true; viewer_count: number } | { ok: false; hata: string }> {
  const { data, error } = await supabase.rpc('canli_yayin_izleyici_gir', {
    p_session_id: sessionId,
  });
  if (error) return { ok: false, hata: error.message };
  const row = data as { viewer_count?: number };
  return { ok: true, viewer_count: Number(row?.viewer_count ?? 0) };
}

export async function CanliYayinIzleyiciCik(
  sessionId: string,
): Promise<{ ok: true; viewer_count: number } | { ok: false; hata: string }> {
  const { data, error } = await supabase.rpc('canli_yayin_izleyici_cik', {
    p_session_id: sessionId,
  });
  if (error) return { ok: false, hata: error.message };
  const row = data as { viewer_count?: number };
  return { ok: true, viewer_count: Number(row?.viewer_count ?? 0) };
}

export async function CanliYayinModerasyon(input: {
  sessionId: string;
  targetUserId: string;
  action: 'kick' | 'ban' | 'unban';
  reason?: string;
}): Promise<{ ok: true } | { ok: false; hata: string }> {
  const { error } = await supabase.rpc('canli_yayin_moderasyon', {
    p_session_id: input.sessionId,
    p_target_user_id: input.targetUserId,
    p_action: input.action,
    p_reason: input.reason ?? null,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}
