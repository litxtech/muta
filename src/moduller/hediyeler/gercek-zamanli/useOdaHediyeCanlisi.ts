/**
 * Oda hediye realtime — diğer kullanıcıların hediyelerini animasyon kuyruğuna ekler.
 */

import { useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import type { Gift } from '../../../types/models';
import { HediyeAnimasyonuKuyrugu } from '../animasyon/HediyeAnimasyonuKuyrugu';

type GiftTxRow = {
  id: string;
  room_id: string | null;
  sender_id: string;
  gift_id: string;
  quantity: number;
  coins_spent?: number;
};

export function useOdaHediyeCanlisi(params: {
  roomId: string | undefined;
  selfUserId: string | undefined;
  gifts: Gift[];
  enabled?: boolean;
}) {
  const { roomId, selfUserId, gifts, enabled = true } = params;
  const giftsRef = useRef(gifts);
  giftsRef.current = gifts;
  const gorulenRef = useRef(new Set<string>());

  useEffect(() => {
    if (!enabled || !roomId) return;

    const channel = supabase
      .channel(`oda-hediye-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'gift_transactions',
          filter: `room_id=eq.${roomId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          const row = payload.new as unknown as GiftTxRow;
          if (!row?.id || !row.gift_id) return;
          if (gorulenRef.current.has(row.id)) return;
          gorulenRef.current.add(row.id);
          // Gönderen zaten lokal kuyruğa ekledi
          if (selfUserId && row.sender_id === selfUserId) return;

          void (async () => {
            const gift = giftsRef.current.find((g) => g.id === row.gift_id);
            const adet = Math.max(1, Number(row.quantity) || 1);
            const coin =
              Number(row.coins_spent) || (gift ? gift.coin_cost * adet : 0);

            const { data: profil } = await supabase
              .from('profiles')
              .select('display_name, username')
              .eq('id', row.sender_id)
              .maybeSingle();

            HediyeAnimasyonuKuyrugu.ekle({
              id: `rt_${row.id}`,
              giftId: row.gift_id,
              emoji: gift?.emoji ?? '🎁',
              name: gift
                ? adet > 1
                  ? `${gift.name} x${adet}`
                  : gift.name
                : adet > 1
                  ? `Hediye x${adet}`
                  : 'Hediye',
              senderName:
                profil?.display_name ?? profil?.username ?? 'Birisi',
              durationMs: gift?.duration_ms ?? 2200,
              fullScreen: !!(gift?.full_screen || coin >= 999 || adet >= 77),
              coinCost: gift?.coin_cost ?? coin,
              quantity: adet,
              animationUrl: gift?.animation_url,
              animationType: gift?.animation_type,
            });
          })();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, roomId, selfUserId]);
}
