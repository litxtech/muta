import { supabase } from '../../../lib/supabase';
import type { GeoSehir } from './SehirleriGetir';

export type SehirDetayOzeti = {
  city: GeoSehir;
  supported: boolean;
  is_primary: boolean;
  is_leader?: boolean;
  today_power?: number;
  standing: {
    season_id: string;
    points: number;
    gifts_score: number;
    battle_wins: number;
    rank: number | null;
  } | null;
  roles: Array<{
    role: string;
    user_id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  }>;
  rooms: Array<{
    id: string;
    city_id: string;
    room_id: string | null;
    title: string;
    is_official: boolean;
    is_live: boolean;
    listener_count: number;
    sort_order: number;
  }>;
  battle: {
    id: string;
    status: string;
    score_a: number;
    score_b: number;
    city_a_id: string;
    city_b_id: string;
    city_a_name: string;
    city_b_name: string;
    starts_at: string | null;
    ends_at: string | null;
  } | null;
  election: {
    id: string;
    title: string;
    status: string;
    role_target: string;
    ends_at: string;
  } | null;
  announcements?: Array<{
    id: string;
    title: string;
    body: string;
    is_pinned: boolean;
    created_at: string;
    author_name: string | null;
  }>;
  how_it_works: string[];
};

export async function SehirDetayGetir(cityId: string): Promise<SehirDetayOzeti> {
  const { data, error } = await supabase.rpc('sehir_detay_ozeti', {
    p_city_id: cityId,
  });
  if (error) throw error;
  const raw = data as SehirDetayOzeti;
  return {
    ...raw,
    city: {
      ...raw.city,
      supporter_count: Number(raw.city?.supporter_count) || 0,
      power_score: Number(raw.city?.power_score) || 0,
    },
    standing: raw.standing
      ? {
          ...raw.standing,
          points: Number(raw.standing.points) || 0,
          gifts_score: Number(raw.standing.gifts_score) || 0,
          battle_wins: Number(raw.standing.battle_wins) || 0,
        }
      : null,
    roles: raw.roles ?? [],
    rooms: raw.rooms ?? [],
    announcements: raw.announcements ?? [],
    today_power: Number(raw.today_power) || 0,
    is_leader: !!raw.is_leader,
    how_it_works: raw.how_it_works ?? [],
  };
}
