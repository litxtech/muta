/**
 * NOX REELS — son büyük kazananlar (oyun_kazanc_duyurulari üzerinden).
 */

import { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { GAME_CODE } from '../sabitler/SlotAyarlari';

export type SlotBigWinTickerItem = {
  id: string;
  displayName: string;
  winAmount: number;
  createdAt: string;
};

export function useSlotRealtimeTicker(limit = 8) {
  const [items, setItems] = useState<SlotBigWinTickerItem[]>([]);

  useEffect(() => {
    let alive = true;

    async function load() {
      const { data } = await supabase
        .from('oyun_kazanc_duyurulari')
        .select('id, win_amount, created_at, user_id')
        .eq('game_code', GAME_CODE)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!alive || !data) return;
      setItems(
        (data as Array<Record<string, unknown>>).map((row) => ({
          id: String(row.id),
          displayName: 'Oyuncu',
          winAmount: Number(row.win_amount ?? 0),
          createdAt: String(row.created_at ?? ''),
        })),
      );
    }

    void load();

    const channel = supabase
      .channel(`nox-ticker-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'oyun_kazanc_duyurulari',
          filter: `game_code=eq.${GAME_CODE}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            win_amount: number;
            created_at: string;
            user_id: string;
          };
          setItems((prev) =>
            [
              {
                id: row.id,
                displayName: 'Oyuncu',
                winAmount: Number(row.win_amount ?? 0),
                createdAt: row.created_at,
              },
              ...prev,
            ].slice(0, limit),
          );
        },
      )
      .subscribe();

    return () => {
      alive = false;
      void supabase.removeChannel(channel);
    };
  }, [limit]);

  return items;
}
