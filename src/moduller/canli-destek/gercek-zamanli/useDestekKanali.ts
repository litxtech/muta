import { useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import type { DestekMesaj, DestekOturum } from '../tipler';

/** Destek mesajlari + oturum durumu realtime */
export function useDestekKanali(
  sessionId: string | undefined,
  onMesaj: (msg: DestekMesaj) => void,
  onOturum: (row: DestekOturum) => void,
) {
  const msgCb = useRef(onMesaj);
  const otCb = useRef(onOturum);
  msgCb.current = onMesaj;
  otCb.current = onOturum;

  useEffect(() => {
    if (!sessionId) return;

    const topic = `destek-${sessionId}`;
    for (const ch of supabase.getChannels()) {
      if (ch.topic === `realtime:${topic}` || ch.topic === topic) {
        void supabase.removeChannel(ch);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kanal: any = supabase.channel(topic);
    kanal
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload: { new: DestekMesaj }) => {
          if (payload.new?.id) msgCb.current(payload.new);
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'support_sessions',
          filter: `id=eq.${sessionId}`,
        },
        (payload: { new: DestekOturum }) => {
          if (payload.new?.id) otCb.current(payload.new);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(kanal);
    };
  }, [sessionId]);
}
