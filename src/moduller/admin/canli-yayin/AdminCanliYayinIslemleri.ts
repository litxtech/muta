import { supabase } from '../../../lib/supabase';

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
