import { useCallback, useEffect, useState } from 'react';
import i18n from '../../../i18n';
import { useAuth } from '../../../contexts/AuthContext';
import { TakipServisi } from '../islemler/TakipServisi';
import type { TakipDurumu } from '../TakipTipleri';

export function useTakipDurumu(targetUserId: string | null | undefined) {
  const { user } = useAuth();
  const [durum, setDurum] = useState<TakipDurumu | null>(null);
  const [yukleniyor, setYukleniyor] = useState(!!targetUserId);
  const [hata, setHata] = useState<string | null>(null);

  const yenile = useCallback(async () => {
    if (!targetUserId) {
      setDurum(null);
      setYukleniyor(false);
      return;
    }
    setYukleniyor(true);
    setHata(null);
    try {
      const d = await TakipServisi.durumGetir(targetUserId, user?.id);
      setDurum(d);
    } catch (e) {
      setHata(e instanceof Error ? e.message : i18n.t('takip.yuklenemedi'));
    } finally {
      setYukleniyor(false);
    }
  }, [targetUserId, user?.id]);

  useEffect(() => {
    void yenile();
  }, [yenile]);

  return { durum, setDurum, yukleniyor, hata, yenile };
}
