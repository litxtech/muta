import { supabase } from '../../../lib/supabase';
import type { CanliSohbetMesajGorunum } from '../bilesenler/CanliSohbetMesajKarti';

type ProfilJoin = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  level?: number | null;
};

function mapla(
  rows: Array<{
    id: string;
    user_id: string;
    body: string;
    created_at: string;
    profile?: ProfilJoin | null;
  }>,
): CanliSohbetMesajGorunum[] {
  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    body: r.body,
    created_at: r.created_at,
    display_name: r.profile?.display_name ?? null,
    username: r.profile?.username ?? null,
    avatar_url: r.profile?.avatar_url ?? null,
    level:
      typeof r.profile?.level === 'number' ? r.profile.level : null,
  }));
}

export async function OdaSohbetMesajlariniGetir(
  roomId: string,
  limit = 50,
): Promise<CanliSohbetMesajGorunum[]> {
  const { data, error } = await supabase.rpc('oda_sohbet_mesajlarini_getir', {
    p_room_id: roomId,
    p_limit: limit,
  });
  if (!error && data) {
    return ((data as any[]) ?? [])
      .map((r) => ({
        id: r.id,
        user_id: r.user_id,
        body: r.body,
        created_at: r.created_at,
        display_name: r.display_name,
        username: r.username,
        avatar_url: r.avatar_url,
        level: typeof r.level === 'number' ? r.level : null,
      }))
      .reverse();
  }

  const fb = await supabase
    .from('room_chat_messages')
    .select(
      'id, user_id, body, created_at, profile:profiles!room_chat_messages_user_id_fkey(id, display_name, username, avatar_url, level)',
    )
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (fb.error) throw fb.error;
  return mapla((fb.data as any[]) ?? []).reverse();
}

export async function CanliYayinSohbetMesajlariniGetir(
  sessionId: string,
  limit = 50,
): Promise<CanliSohbetMesajGorunum[]> {
  const { data, error } = await supabase.rpc('canli_sohbet_mesajlarini_getir', {
    p_session_id: sessionId,
    p_limit: limit,
  });
  if (!error && data) {
    return ((data as any[]) ?? [])
      .map((r) => ({
        id: r.id,
        user_id: r.user_id,
        body: r.body,
        created_at: r.created_at,
        display_name: r.display_name,
        username: r.username,
        avatar_url: r.avatar_url,
      }))
      .reverse();
  }

  const fb = await supabase
    .from('live_chat_messages')
    .select(
      'id, user_id, body, created_at, profile:profiles!live_chat_messages_user_id_fkey(id, display_name, username, avatar_url)',
    )
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (fb.error) throw fb.error;
  return mapla((fb.data as any[]) ?? []).reverse();
}

export async function OdaSohbetMesajiGonder(input: {
  roomId: string;
  body: string;
}): Promise<{ ok: true } | { ok: false; hata: string }> {
  const { error } = await supabase.rpc('oda_sohbet_mesaji_gonder', {
    p_room_id: input.roomId,
    p_body: input.body,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}

export async function CanliYayinSohbetMesajiGonder(input: {
  sessionId: string;
  body: string;
}): Promise<{ ok: true } | { ok: false; hata: string }> {
  const { error } = await supabase.rpc('canli_sohbet_mesaji_gonder', {
    p_session_id: input.sessionId,
    p_body: input.body,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}

export async function OdaSohbetMesajiSil(
  messageId: string,
): Promise<{ ok: true } | { ok: false; hata: string }> {
  const { error } = await supabase.rpc('oda_sohbet_mesaji_sil', {
    p_message_id: messageId,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}

export async function CanliYayinSohbetMesajiSil(
  messageId: string,
): Promise<{ ok: true } | { ok: false; hata: string }> {
  const { error } = await supabase.rpc('canli_sohbet_mesaji_sil', {
    p_message_id: messageId,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}
