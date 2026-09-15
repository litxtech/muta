/**
 * Admin'de açık oyun kodlarını yükler — kapalı oyunlar UI'da kullanılmaz.
 */

import { useCallback, useEffect, useState } from 'react';
import { listVisibleGameCodes } from '../servisler/OyunKontrolServisi';
import type { GameCode } from '../tipler/OyunTipleri';

export function useGorunurOyunKodlari(params?: { enabled?: boolean }) {
  const enabled = params?.enabled !== false;
  const [codes, setCodes] = useState<GameCode[]>([]);
  const [loading, setLoading] = useState(enabled);

  const yenile = useCallback(async () => {
    if (!enabled) {
      setCodes([]);
      setLoading(false);
      return [] as GameCode[];
    }
    setLoading(true);
    const res = await listVisibleGameCodes();
    const next = res.ok ? res.data : [];
    setCodes(next);
    setLoading(false);
    return next;
  }, [enabled]);

  useEffect(() => {
    void yenile();
  }, [yenile]);

  return {
    codes,
    anyVisible: codes.length > 0,
    isVisible: (code: GameCode) => codes.includes(code),
    loading,
    yenile,
  };
}
