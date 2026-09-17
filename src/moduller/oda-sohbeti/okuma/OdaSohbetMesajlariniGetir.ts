import { supabase } from '../../../lib/supabase';

export type OdaSohbetMesaji = {
  id: string;
  room_id: string;
  user_id: string;
  body: string;
  created_at: string;
  profile?: {
    id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
    level?: number | null;
  } | null;
};

export async function OdaSohbetMesajlariniGetir(
  roomId: string,
  limit = 40,
): Promise<OdaSohbetMesaji[]> {
  const { data, error } = await supabase
    .from('room_chat_messages')
    .select(
      '*, profile:profiles!room_chat_messages_user_id_fkey(id, display_name, username, avatar_url, level)',
    )
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data as OdaSohbetMesaji[]) ?? []).reverse();
}
