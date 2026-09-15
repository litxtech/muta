import { supabase } from '../../../lib/supabase';

export type PkMac = {
  id: string;
  pk_type: string;
  status: string;
  score_a: number;
  score_b: number;
  started_at: string | null;
  ends_at: string | null;
};

export type PkTarafOnizleme = {
  title: string | null;
  cover_url: string | null;
  avatar_url: string | null;
  host_name: string | null;
  listener_count?: number;
};

export type PkMacZengin = PkMac & {
  room_a_id?: string | null;
  room_b_id?: string | null;
  live_a_id?: string | null;
  live_b_id?: string | null;
  side_a: PkTarafOnizleme | null;
  side_b: PkTarafOnizleme | null;
};

type RoomJoin = {
  id: string;
  title: string | null;
  cover_url: string | null;
  listener_count?: number | null;
  host?: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
};

type LiveJoin = {
  id: string;
  title: string | null;
  host?: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
};

function tarafFromRoom(r?: RoomJoin | null): PkTarafOnizleme | null {
  if (!r) return null;
  return {
    title: r.title,
    cover_url: r.cover_url,
    avatar_url: r.host?.avatar_url ?? null,
    host_name:
      r.host?.display_name?.trim() ||
      (r.host?.username ? `@${r.host.username}` : null),
    listener_count: r.listener_count ?? 0,
  };
}

function tarafFromLive(l?: LiveJoin | null): PkTarafOnizleme | null {
  if (!l) return null;
  return {
    title: l.title,
    cover_url: l.host?.avatar_url ?? null,
    avatar_url: l.host?.avatar_url ?? null,
    host_name:
      l.host?.display_name?.trim() ||
      (l.host?.username ? `@${l.host.username}` : null),
  };
}

/** Skor client belirlemez — sadece okur; onizleme icin kapak/host zenginlestirir */
export async function PkCanliMaclariGetir(): Promise<PkMacZengin[]> {
  const { data, error } = await supabase
    .from('pk_matches')
    .select(
      `
      id, pk_type, status, score_a, score_b, started_at, ends_at,
      room_a_id, room_b_id, live_a_id, live_b_id,
      room_a:rooms!pk_matches_room_a_id_fkey(
        id, title, cover_url, listener_count,
        host:profiles!rooms_host_id_fkey(display_name, username, avatar_url)
      ),
      room_b:rooms!pk_matches_room_b_id_fkey(
        id, title, cover_url, listener_count,
        host:profiles!rooms_host_id_fkey(display_name, username, avatar_url)
      ),
      live_a:live_sessions!pk_matches_live_a_id_fkey(
        id, title,
        host:profiles!live_sessions_host_id_fkey(display_name, username, avatar_url)
      ),
      live_b:live_sessions!pk_matches_live_b_id_fkey(
        id, title,
        host:profiles!live_sessions_host_id_fkey(display_name, username, avatar_url)
      )
    `,
    )
    .eq('status', 'live')
    .order('started_at', { ascending: false })
    .limit(20);

  if (error) {
    // Join basarisizsa sade liste
    const fb = await supabase
      .from('pk_matches')
      .select('id, pk_type, status, score_a, score_b, started_at, ends_at')
      .eq('status', 'live')
      .order('started_at', { ascending: false })
      .limit(20);
    if (fb.error) throw fb.error;
    return ((fb.data as PkMac[]) ?? []).map((m) => ({
      ...m,
      side_a: null,
      side_b: null,
    }));
  }

  return ((data as any[]) ?? []).map((row) => ({
    id: row.id,
    pk_type: row.pk_type,
    status: row.status,
    score_a: row.score_a,
    score_b: row.score_b,
    started_at: row.started_at,
    ends_at: row.ends_at,
    room_a_id: row.room_a_id,
    room_b_id: row.room_b_id,
    live_a_id: row.live_a_id,
    live_b_id: row.live_b_id,
    side_a: tarafFromRoom(row.room_a) ?? tarafFromLive(row.live_a),
    side_b: tarafFromRoom(row.room_b) ?? tarafFromLive(row.live_b),
  }));
}

export async function PkSkorOku(matchId: string): Promise<PkMac | null> {
  const { data, error } = await supabase
    .from('pk_matches')
    .select('id, pk_type, status, score_a, score_b, started_at, ends_at')
    .eq('id', matchId)
    .maybeSingle();
  if (error) throw error;
  return data as PkMac | null;
}
