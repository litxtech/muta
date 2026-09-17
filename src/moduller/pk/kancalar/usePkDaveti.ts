import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  PkBekleyenDavetiGetir,
  type PkDavet,
} from '../islemler/PkDavetIslemleri';

/** Canlı yayıncının gelen PK davetini dinler */
export function usePkDaveti(params: {
  hostUserId: string | undefined;
  enabled?: boolean;
}) {
  const { hostUserId, enabled = true } = params;
  const [davet, setDavet] = useState<PkDavet | null>(null);

  const yenile = useCallback(async () => {
    if (!hostUserId) {
      setDavet(null);
      return;
    }
    const row = await PkBekleyenDavetiGetir(hostUserId);
    setDavet(row);
  }, [hostUserId]);

  useEffect(() => {
    if (!enabled || !hostUserId) {
      setDavet(null);
      return;
    }

    void yenile();

    const ch = supabase
      .channel(`pk-davet-${hostUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pk_invites',
          filter: `to_host_id=eq.${hostUserId}`,
        },
        (payload: { new?: Record<string, unknown>; eventType?: string }) => {
          const row = payload.new;
          if (!row) {
            void yenile();
            return;
          }
          if (row.status === 'pending') {
            void yenile();
            return;
          }
          setDavet((prev) => (prev?.id === row.id ? null : prev));
        },
      )
      .subscribe();

    const tick = setInterval(() => {
      setDavet((prev) => {
        if (!prev) return prev;
        if (new Date(prev.expires_at).getTime() <= Date.now()) return null;
        return prev;
      });
    }, 1000);

    return () => {
      clearInterval(tick);
      void supabase.removeChannel(ch);
    };
  }, [enabled, hostUserId, yenile]);

  return { davet, temizle: () => setDavet(null), yenile };
}
