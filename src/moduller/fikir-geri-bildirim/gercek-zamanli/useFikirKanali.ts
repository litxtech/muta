import { useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';

/** Fikir satırı + durum geçmişi realtime (tek kanal, cleanup'lı) */
export function useFikirKanali(
  feedbackId: string | undefined,
  onDegisti: () => void,
) {
  const cb = useRef(onDegisti);
  cb.current = onDegisti;

  useEffect(() => {
    if (!feedbackId) return;

    const topic = `fikir-${feedbackId}`;
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
          event: 'UPDATE',
          schema: 'public',
          table: 'platform_feedback',
          filter: `id=eq.${feedbackId}`,
        },
        () => cb.current(),
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'feedback_status_history',
          filter: `feedback_id=eq.${feedbackId}`,
        },
        () => cb.current(),
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'feedback_admin_replies',
          filter: `feedback_id=eq.${feedbackId}`,
        },
        () => cb.current(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(kanal);
    };
  }, [feedbackId]);
}
