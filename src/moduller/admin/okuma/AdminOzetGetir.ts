import { supabase } from '../../../lib/supabase';
import { AdminPlatformOzetiGetir } from '../platform/AdminPlatformIslemleri';
import type { AdminPlatformOzeti } from '../tipler/PlatformTipleri';

export type AdminOzet = {
  pendingOutbox: number;
  liveRooms: number;
  livePk: number;
  openReports: number;
  platform?: AdminPlatformOzeti | null;
};

/** Admin hub ozet — once genis RPC, olmazsa eski sayim. */
export async function AdminOzetGetir(): Promise<AdminOzet> {
  try {
    const p = await AdminPlatformOzetiGetir();
    return {
      pendingOutbox: p.sosyal.push_kuyruk,
      liveRooms: p.canli.odalar,
      livePk: p.canli.pk,
      openReports: p.sosyal.acik_rapor,
      platform: p,
    };
  } catch {
    const [outbox, rooms, pk, reports] = await Promise.all([
      supabase
        .from('notification_outbox')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabase
        .from('rooms')
        .select('id', { count: 'exact', head: true })
        .eq('is_live', true),
      supabase
        .from('pk_matches')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'live'),
      supabase
        .from('user_reports')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'open'),
    ]);

    return {
      pendingOutbox: outbox.count ?? 0,
      liveRooms: rooms.count ?? 0,
      livePk: pk.count ?? 0,
      openReports: reports.count ?? 0,
      platform: null,
    };
  }
}
