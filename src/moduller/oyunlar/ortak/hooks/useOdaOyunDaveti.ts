/**
 * Oda bazlı oyun daveti — INSERT + mevcut waiting oturum.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import type { GameSession } from '../tipler/OyunTipleri';

export function useOdaOyunDaveti(params: {
  roomId: string | undefined;
  selfUserId: string | undefined;
  enabled?: boolean;
}) {
  const { roomId, selfUserId, enabled = true } = params;
  const [inviteSession, setInviteSession] = useState<GameSession | null>(null);

  useEffect(() => {
    if (!enabled || !roomId || !selfUserId) return;

    let cancelled = false;

    void (async () => {
      const { data } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('room_id', roomId)
        .eq('status', 'waiting')
        .neq('host_user_id', selfUserId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled && data) {
        setInviteSession(data as GameSession);
      }
    })();

    const channel = supabase
      .channel(`room_games:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'game_sessions',
          filter: `room_id=eq.${roomId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          const row = payload.new as unknown as GameSession;
          if (!row?.id) return;
          if (row.host_user_id === selfUserId) return;
          if (row.status !== 'waiting') return;
          setInviteSession(row);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [enabled, roomId, selfUserId]);

  return {
    inviteSession,
    clearInvite: () => setInviteSession(null),
  };
}
