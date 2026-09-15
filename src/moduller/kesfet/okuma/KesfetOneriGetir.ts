import { supabase } from '../../../lib/supabase';
import type { Room } from '../../../types/models';
import type { KesfetFiltresi } from '../filtreler/KesfetFiltreleri';

/**
 * Kesfet oneri — canli odalari filtre/sirala.
 */
export async function KesfetOneriGetir(input: {
  filtre: KesfetFiltresi;
  kategori?: string | null;
  limit?: number;
}): Promise<Room[]> {
  const limit = input.limit ?? 40;
  let q = supabase
    .from('rooms')
    .select('*, host:profiles!rooms_host_id_fkey(*)')
    .eq('is_live', true)
    .limit(limit);

  switch (input.filtre) {
    case 'trending':
      q = q.order('total_coins_earned', { ascending: false });
      break;
    case 'new_creator':
      q = q.order('created_at', { ascending: false });
      break;
    case 'online':
      q = q.gt('listener_count', 0).order('listener_count', { ascending: false });
      break;
    case 'live':
    case 'voice_room':
    default:
      q = q.order('listener_count', { ascending: false });
  }

  if (input.kategori) {
    q = q.eq('mode', input.kategori);
  }

  const { data, error } = await q;
  if (error) throw error;
  return filtreleYerel((data as Room[]) ?? [], input.filtre);
}

function filtreleYerel(rooms: Room[], filtre: KesfetFiltresi): Room[] {
  switch (filtre) {
    case 'live':
      // Canli yayin odalari — game/party disi "show" yaklasimi: yuksek dinleyici
      return rooms.filter((r) => r.listener_count >= 0);
    case 'voice_room':
      return rooms.filter((r) =>
        ['party', 'karaoke', 'game', 'dating'].includes(r.mode),
      );
    case 'country':
      return rooms.filter((r) => !!r.host?.country);
    case 'language':
      return rooms.filter((r) => !!r.host?.language);
    default:
      return rooms;
  }
}
