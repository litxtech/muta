import { supabase } from '../../../lib/supabase';
import type { Profile, Room, RoomMode } from '../../../types/models';

export type FeedOggesi = {
  id: string;
  tur: 'oda' | 'canli';
  title: string;
  topic?: string | null;
  mode?: RoomMode | string | null;
  listener_count: number;
  cover_url: string | null;
  host: Pick<
    Profile,
    'id' | 'display_name' | 'username' | 'avatar_url' | 'level'
  > | null;
  href: string;
  skor: number;
  created_at: string;
  popular?: boolean;
};

type LiveRow = {
  id: string;
  title: string;
  mode: string | null;
  viewer_count?: number | null;
  like_count?: number | null;
  gift_count?: number | null;
  total_coins_earned?: number | null;
  score?: number | null;
  started_at?: string | null;
  created_at?: string | null;
  host?: {
    id: string;
    display_name: string | null;
    username: string | null;
    public_user_id?: string | null;
    level?: number | null;
    avatar_url?: string | null;
  } | null;
};

/** Canlı odalar + canlı yayınlar → tek ana akım listesi */
export async function CanliFeedGetir(limit = 40): Promise<FeedOggesi[]> {
  const [odalarRes, canliRes] = await Promise.all([
    supabase
      .from('rooms')
      .select('*, host:profiles!rooms_host_id_fkey(*)')
      .eq('is_live', true)
      .order('listener_count', { ascending: false })
      .limit(limit),
    supabase
      .from('live_sessions')
      .select(
        '*, host:profiles!live_sessions_host_id_fkey(id, display_name, username, public_user_id, level, avatar_url)',
      )
      .eq('is_live', true)
      .order('started_at', { ascending: false })
      .limit(Math.min(limit, 20)),
  ]);

  const ogeler: FeedOggesi[] = [];

  for (const r of (odalarRes.data as Room[]) ?? []) {
    ogeler.push({
      id: `oda:${r.id}`,
      tur: 'oda',
      title: r.title,
      topic: r.topic,
      mode: r.mode,
      listener_count: r.listener_count ?? 0,
      cover_url: r.cover_url ?? r.host?.avatar_url ?? null,
      host: r.host
        ? {
            id: r.host.id,
            display_name: r.host.display_name,
            username: r.host.username,
            avatar_url: r.host.avatar_url,
            level: r.host.level,
          }
        : null,
      href: `/lobi/${r.id}`,
      skor: (r.listener_count ?? 0) * 10 + Math.min(r.total_coins_earned ?? 0, 5000) / 50,
      created_at: r.created_at,
    });
  }

  for (const c of (canliRes.data as LiveRow[]) ?? []) {
    // Aynı host’un odası zaten listede ise yayını atla (çift içerik)
    const hostId = c.host?.id;
    if (hostId && ogeler.some((o) => o.tur === 'oda' && o.host?.id === hostId)) {
      continue;
    }
    const giftBoost = Math.min(Number(c.total_coins_earned ?? c.score ?? 0), 8000) / 40;
    const likeBoost = (c.like_count ?? 0) * 4;
    const giftCountBoost = (c.gift_count ?? 0) * 12;
    const skor =
      25 +
      (c.viewer_count ?? 0) * 8 +
      likeBoost +
      giftCountBoost +
      giftBoost;
    ogeler.push({
      id: `canli:${c.id}`,
      tur: 'canli',
      title: c.title,
      mode: c.mode,
      listener_count: c.viewer_count ?? 0,
      cover_url: c.host?.avatar_url ?? null,
      host: c.host
        ? {
            id: c.host.id,
            display_name: c.host.display_name,
            username: c.host.username,
            avatar_url: c.host.avatar_url ?? null,
            level: c.host.level ?? 1,
          }
        : null,
      href: `/canli/${c.id}`,
      skor,
      popular: (c.gift_count ?? 0) > 0 || (c.like_count ?? 0) > 5 || skor >= 80,
      created_at: c.started_at ?? c.created_at ?? new Date().toISOString(),
    });
  }

  ogeler.sort((a, b) => b.skor - a.skor || b.created_at.localeCompare(a.created_at));
  return ogeler.slice(0, limit);
}

/** Geriye uyumluluk */
export async function CanliOdalariGetir(limit = 20): Promise<Room[]> {
  const { data, error } = await supabase
    .from('rooms')
    .select('*, host:profiles!rooms_host_id_fkey(*)')
    .eq('is_live', true)
    .order('listener_count', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as Room[]) ?? [];
}

export async function TrendOdalariGetir(limit = 10): Promise<Room[]> {
  const { data, error } = await supabase
    .from('rooms')
    .select('*, host:profiles!rooms_host_id_fkey(*)')
    .eq('is_live', true)
    .order('total_coins_earned', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as Room[]) ?? [];
}
