/**
 * Odaya yeni katılan seviye 10+ kullanıcılar için giriş animasyonu kuyruğu.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  SeviyeGirisKademesiniCoz,
  type SeviyeGirisOgesi,
} from '../animasyon/SeviyeGirisKatalogu';

type Opts = {
  roomId?: string | null;
  enabled?: boolean;
  /** Kendi profil — odaya ilk girince animasyon (sv≥10) */
  self?: {
    userId: string;
    ad: string;
    avatarUrl?: string | null;
    level: number;
  } | null;
};

export function useOdaSeviyeGiris({ roomId, enabled = true, self }: Opts) {
  const [aktif, setAktif] = useState<SeviyeGirisOgesi | null>(null);
  const kuyrukRef = useRef<SeviyeGirisOgesi[]>([]);
  const gorulenRef = useRef<Set<string>>(new Set());
  const oynuyorRef = useRef(false);
  const selfGosterildiRef = useRef(false);

  const sonraki = useCallback(() => {
    if (oynuyorRef.current) return;
    const next = kuyrukRef.current.shift();
    if (!next) {
      setAktif(null);
      return;
    }
    oynuyorRef.current = true;
    setAktif(next);
  }, []);

  const kuyrugaEkle = useCallback(
    (oge: SeviyeGirisOgesi) => {
      if (gorulenRef.current.has(oge.userId)) return;
      gorulenRef.current.add(oge.userId);
      kuyrukRef.current.push(oge);
      sonraki();
    },
    [sonraki],
  );

  const bitti = useCallback(() => {
    oynuyorRef.current = false;
    setAktif(null);
    requestAnimationFrame(() => sonraki());
  }, [sonraki]);

  /** Kendi giriş animasyonu (bir kez) */
  useEffect(() => {
    if (!enabled || !roomId || !self?.userId) return;
    if (selfGosterildiRef.current) return;
    const kademe = SeviyeGirisKademesiniCoz(self.level);
    if (!kademe) return;
    selfGosterildiRef.current = true;
    kuyrugaEkle({
      userId: self.userId,
      ad: self.ad,
      avatarUrl: self.avatarUrl,
      level: self.level,
      kademe,
    });
  }, [enabled, roomId, self, kuyrugaEkle]);

  /** Başkalarının odaya katılması */
  useEffect(() => {
    if (!enabled || !roomId) return;

    const imza = `oda-seviye-giris-${roomId}`;
    for (const ch of supabase.getChannels()) {
      const topic = ch.topic ?? '';
      if (topic.includes(imza)) void supabase.removeChannel(ch);
    }

    const channel = supabase
      .channel(`${imza}-${Date.now().toString(36)}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_members',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const row = payload.new as { user_id?: string } | null;
          const uid = row?.user_id;
          if (!uid || uid === self?.userId) return;
          if (gorulenRef.current.has(uid)) return;

          void (async () => {
            const { data } = await supabase
              .from('profiles')
              .select('id, display_name, username, avatar_url, level')
              .eq('id', uid)
              .maybeSingle();
            if (!data) return;
            const level = typeof data.level === 'number' ? data.level : 0;
            const kademe = SeviyeGirisKademesiniCoz(level);
            if (!kademe) return;
            const ad =
              (data.display_name as string | null)?.trim() ||
              (data.username as string | null)?.trim() ||
              'Kullanıcı';
            kuyrugaEkle({
              userId: uid,
              ad,
              avatarUrl: (data.avatar_url as string | null) ?? null,
              level,
              kademe,
            });
          })();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, roomId, self?.userId, kuyrugaEkle]);

  useEffect(() => {
    gorulenRef.current = new Set();
    kuyrukRef.current = [];
    oynuyorRef.current = false;
    selfGosterildiRef.current = false;
    setAktif(null);
  }, [roomId]);

  return { aktif, bitti };
}
