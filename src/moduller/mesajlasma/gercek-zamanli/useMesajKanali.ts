import { useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import type { DirektMesaj } from '../okuma/MesajlariGetir';

type ChangePayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: DirektMesaj;
  old: Partial<DirektMesaj>;
};

/**
 * Telegram tarzi anlik mesaj kanali — INSERT/UPDATE/DELETE
 */
export function useMesajKanali(
  threadId: string | undefined,
  onMesaj: (msg: DirektMesaj, event: 'INSERT' | 'UPDATE' | 'DELETE') => void,
) {
  const cb = useRef(onMesaj);
  cb.current = onMesaj;

  useEffect(() => {
    if (!threadId || threadId === 'yeni') return;

    const topic = `dm-thread-${threadId}`;
    for (const ch of supabase.getChannels()) {
      if (ch.topic === `realtime:${topic}` || ch.topic === topic) {
        void supabase.removeChannel(ch);
      }
    }

    const handle = (payload: ChangePayload) => {
      if (payload.eventType === 'DELETE') {
        cb.current(
          {
            id: payload.old?.id ?? '',
            thread_id: threadId,
          } as DirektMesaj,
          'DELETE',
        );
        return;
      }
      const row = payload.new;
      if (!row?.id) return;
      cb.current(row, payload.eventType);
    };

    // supabase-js realtime typing strict — channel builder
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kanal: any = supabase.channel(topic);
    kanal
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'direct_messages',
          filter: `thread_id=eq.${threadId}`,
        },
        handle,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(kanal);
    };
  }, [threadId]);
}

/** Inbox listesini anlik yenile */
export function useMesajInboxKanali(onDegisti: () => void) {
  const cb = useRef(onDegisti);
  cb.current = onDegisti;

  useEffect(() => {
    const topic = 'dm-inbox';
    for (const ch of supabase.getChannels()) {
      if (ch.topic === `realtime:${topic}` || ch.topic === topic) {
        void supabase.removeChannel(ch);
      }
    }

    const yenile = () => cb.current();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kanal: any = supabase.channel(topic);
    kanal
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'message_threads' },
        yenile,
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages' },
        yenile,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(kanal);
    };
  }, []);
}
