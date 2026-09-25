/**
 * Inbox listesi için taslak haritası — tek AsyncStorage okuma + abonelik.
 */

import { useEffect, useState } from 'react';
import {
  MesajTaslakAboneOl,
  MesajTaslakHaritasiniYukle,
  MesajTaslakMetinHaritasi,
  type MesajTaslakHarita,
} from './MesajTaslakDepolama';

/** conversationId → draft metin */
export function useMesajTaslakHaritasi(
  userId: string | undefined,
): Record<string, string> {
  const [metinler, setMetinler] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!userId) {
      setMetinler({});
      return;
    }

    let iptal = false;
    const uygula = (harita: MesajTaslakHarita) => {
      if (!iptal) setMetinler(MesajTaslakMetinHaritasi(harita));
    };

    void MesajTaslakHaritasiniYukle(userId).then(uygula);
    const iptalAbone = MesajTaslakAboneOl(userId, uygula);

    return () => {
      iptal = true;
      iptalAbone();
    };
  }, [userId]);

  return metinler;
}
