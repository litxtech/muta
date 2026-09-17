import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  PkCanliMaciniGetir,
  type PkCanliMacDetay,
} from '../skor/PkCanliMaciniGetir';

/** Canlı oturumun aktif PK maçını skor realtime ile takip eder */
export function useCanliPkMac(params: {
  liveSessionId: string | undefined;
  enabled?: boolean;
}) {
  const { liveSessionId, enabled = true } = params;
  const [mac, setMac] = useState<PkCanliMacDetay | null>(null);

  const yenile = useCallback(async () => {
    if (!liveSessionId) {
      setMac(null);
      return;
    }
    const row = await PkCanliMaciniGetir(liveSessionId);
    setMac(row);
  }, [liveSessionId]);

  useEffect(() => {
    if (!enabled || !liveSessionId) {
      setMac(null);
      return;
    }

    void yenile();

    const ch = supabase
      .channel(`pk-mac-live-${liveSessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pk_matches',
        },
        (payload: { new?: Record<string, unknown> }) => {
          const row = payload.new;
          if (!row) {
            void yenile();
            return;
          }
          const a = row.live_a_id;
          const b = row.live_b_id;
          if (a === liveSessionId || b === liveSessionId) {
            if (row.status === 'live') {
              setMac((prev) =>
                prev && prev.id === row.id
                  ? {
                      ...prev,
                      score_a: Number(row.score_a ?? prev.score_a),
                      score_b: Number(row.score_b ?? prev.score_b),
                      status: String(row.status),
                      ends_at: (row.ends_at as string | null) ?? prev.ends_at,
                    }
                  : prev,
              );
              void yenile();
            } else {
              setMac(null);
            }
          }
        },
      )
      .subscribe();

    const poll = setInterval(() => void yenile(), 4000);

    return () => {
      clearInterval(poll);
      void supabase.removeChannel(ch);
    };
  }, [enabled, liveSessionId, yenile]);

  return { mac, yenile };
}
