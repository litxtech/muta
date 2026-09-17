import { supabase } from '../../../lib/supabase';
import type { Room, RoomMode } from '../../../types/models';
import type { KesfetFiltresi } from '../filtreler/KesfetFiltreleri';

/**
 * Kesfet oneri — canli odalari filtre/sirala.
 */
export async function KesfetOneriGetir(input: {
  filtre: KesfetFiltresi;
  mode?: RoomMode | null;
  limit?: number;
}): Promise<Room[]> {
  const limit = input.limit ?? 48;
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
    case 'global':
    default:
      q = q.order('listener_count', { ascending: false });
  }

  if (input.mode) {
    q = q.eq('mode', input.mode);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data as Room[]) ?? [];
}
