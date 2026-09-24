import i18n from '../../../i18n';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { PaylasilanDurumlariGetir } from './PaylasilanDurumlariGetir';
import type {
  PaylasilanDurumAvailability,
  PaylasilanDurumOnizleme,
} from './tipler';

/**
 * Konuşmadaki tüm shared_post ref'leri için tek batch fetch +
 * tek realtime kanal (shared-posts). Kart başına subscription yok.
 */
export function usePaylasilanDurumOnizleme(statusIds: string[]) {
  const key = useMemo(() => {
    const u = Array.from(new Set(statusIds.filter(Boolean))).sort();
    return u.join(',');
  }, [statusIds]);

  const ids = useMemo(
    () => (key ? key.split(',').filter(Boolean) : []),
    [key],
  );

  const [map, setMap] = useState<Record<string, PaylasilanDurumOnizleme>>({});
  const [yukleniyor, setYukleniyor] = useState(false);
  const istekNo = useRef(0);

  useEffect(() => {
    if (ids.length === 0) {
      setMap({});
      setYukleniyor(false);
      return;
    }

    const no = ++istekNo.current;
    setYukleniyor(true);
    void (async () => {
      const data = await PaylasilanDurumlariGetir(ids);
      if (istekNo.current !== no) return;
      setMap(data);
      setYukleniyor(false);
    })();
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps -- key ids özeti

  useEffect(() => {
    if (ids.length === 0) return;

    const topic = 'shared-posts';
    for (const ch of supabase.getChannels()) {
      if (ch.topic === `realtime:${topic}` || ch.topic === topic) {
        void supabase.removeChannel(ch);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kanal: any = supabase.channel(topic);
    kanal
      .on(
        'broadcast',
        { event: 'status_post_removed' },
        (payload: {
          payload?: {
            status_id?: string;
            availability?: PaylasilanDurumAvailability;
            removal_source?: string;
          };
        }) => {
          const sid = payload?.payload?.status_id;
          if (!sid || !ids.includes(sid)) return;
          const availability =
            payload.payload?.availability ??
            (payload.payload?.removal_source === 'platform'
              ? 'REMOVED_BY_PLATFORM'
              : 'DELETED_BY_OWNER');
          setMap((prev) => ({
            ...prev,
            [sid]: {
              status_id: sid,
              availability,
              message:
                availability === 'REMOVED_BY_PLATFORM'
                  ? i18n.t('durumX.platformKaldirildi')
                  : i18n.t('durumX.sahibiSildi'),
            },
          }));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(kanal);
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return { map, yukleniyor };
}
